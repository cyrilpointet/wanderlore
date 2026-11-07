import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'

import EventState from '#models/event_state'
import InventoryItem from '#models/inventory_item'
import LocationInstance from '#models/location_instance'
import NpcInstance from '#models/npc_instance'
import PlaceNote from '#models/place_note'
import type WorldState from '#models/world_state'
import type CharacterState from '#models/character_state'
import type { RulesEngine } from '#services/rules/engine'

import { type Holder, characterItems, createItem, destroyItem, transferItem } from './inventory.js'
import { armorOf } from './combat.js'
import { expectedPlaceOf, placeNpc } from './npcs.js'
import {
  blockPassage,
  clearPassage,
  discoverPassage,
  passageBetween,
  unlockPassage,
} from './passages.js'
import { addPending, dropPendingMoves, pendingNpcs } from './pending_effects.js'
import { entryAt, scheduledNpcs } from './schedules.js'
import { EVENT_CHAIN_DEPTH, stateEventsDue, witnesses } from './events.js'
import { loadProgress, loadSnapshot, progressReader } from './game_events.js'
import type { EventEffect, ItemHolderReference, ScenarioEvent } from './content/types.js'
import type { WorldDefinition } from './world.js'
import type { SettledStateEvent, TracedHarm } from './turn_trace.js'

/**
 * The events of a scenario, applied to a game (roadmap, Phase 11). Every
 * effect goes through the services of the game — people, passages, items —
 * and nothing here asks the model: the content says what happens, the
 * backend makes it so.
 */

/** What an effect lands on. */
export type EffectTarget = {
  world: WorldDefinition
  sessionId: string
  /** The game's state, saved by the caller: a flag lands on it. Null where no flag can be set. */
  worldState: WorldState | null
  /** Null where nothing can be handed to the character. */
  characterId: string | null
  /** Where the character stands: whoever an event brings there is present. Null: they wait, absent. */
  placeId: string | null
  /**
   * What an event can hurt: the character's state in this game, and the rules
   * that roll the harm. Null where no one can be hurt.
   */
  harm: { rules: RulesEngine; characterState: CharacterState } | null
}

/**
 * Applies one effect. A person or an item headed for a place the game has
 * never been, or for someone it has never met, waits for them
 * (`#services/game/pending_effects`). The dead stay where they fell.
 */
export async function applyEffect(
  target: EffectTarget,
  effect: EventEffect,
  event: string,
  client?: QueryClientContract
): Promise<void> {
  const { world, sessionId } = target

  switch (effect.type) {
    case 'npc_moved':
      return moveNpc(target, effect.npc, effect.location, { effect, event }, client)

    case 'npc_entered': {
      const definition = world.npcs.find(({ reference }) => reference === effect.npc)

      if (definition === undefined) {
        throw new Error(`"${effect.npc}" is no person of the ${world.reference} world.`)
      }

      if (definition.kind === 'unique') {
        return moveNpc(target, effect.npc, effect.location, { effect, event }, client)
      }

      const place = await placeOf(sessionId, effect.location, client)

      if (place === null) {
        return addPending(
          sessionId,
          [{ waitsFor: { location: effect.location }, effect, event }],
          client
        )
      }

      await placeNpc(
        world,
        sessionId,
        definition,
        { status: statusIn(target, place), place: place.id, descriptor: effect.descriptor },
        client
      )
      return
    }

    case 'npc_left': {
      await dropPendingMoves(sessionId, effect.npc, client)
      const npc = await npcOf(sessionId, effect.npc, client)

      if (npc === null) {
        /** Gone before anyone met them: they wait nowhere in particular now. */
        await placeNpc(
          world,
          sessionId,
          uniqueNpc(world, effect.npc),
          { status: 'absent', place: null },
          client
        )
      } else if (npc.status !== 'dead' && npc.status !== 'dying') {
        npc.merge({ status: 'absent', locationInstanceId: null })
        await npc.save()
      }
      return
    }

    case 'npc_disposition': {
      const npc = await npcOf(sessionId, effect.npc, client)

      if (npc === null) {
        return addPending(sessionId, [{ waitsFor: { npc: effect.npc }, effect, event }], client)
      }

      npc.disposition = effect.disposition
      await npc.save()
      return
    }

    /** Read from the events that fell, never stored: a schedule stopped is one an event stopped. */
    case 'schedule_stopped':
      return

    case 'passage_blocked':
    case 'passage_cleared':
    case 'passage_discovered':
    case 'passage_unlocked': {
      const passage = passageBetween(world.locations, effect.from, effect.to)

      if (passage === null) {
        throw new Error(`No passage joins "${effect.from}" and "${effect.to}".`)
      }

      const apply = {
        passage_blocked: blockPassage,
        passage_cleared: clearPassage,
        passage_discovered: discoverPassage,
        passage_unlocked: unlockPassage,
      }[effect.type]

      return apply(world.locations, sessionId, passage, client)
    }

    case 'place_note_set':
      await PlaceNote.updateOrCreate(
        { sessionId, locationReference: effect.location },
        { note: effect.note, eventReference: event },
        { client }
      )
      return

    case 'place_note_cleared':
      await PlaceNote.query({ client })
        .where('sessionId', sessionId)
        .where('locationReference', effect.location)
        .delete()
      return

    case 'item_placed':
    case 'item_transferred':
      return placeItem(
        target,
        effect.item,
        effect.holder,
        effect.type === 'item_placed' ? effect.quantity : 1,
        { effect, event },
        client
      )

    case 'item_gone': {
      const item = await uniqueItemOf(sessionId, effect.item, client)

      if (item !== null && item.state !== 'gone') {
        await destroyItem(world, item, item.quantity)
      }
      return
    }

    case 'flag_set':
      if (target.worldState !== null) {
        target.worldState.narrativeFlags = {
          ...target.worldState.narrativeFlags,
          [effect.flag]: true,
        }
      }
      return

    case 'character_harmed':
      /** Dealt by `applyEvent`, which knows whether the character is there. */
      return
  }
}

/**
 * Every effect of an event, in the order the content lists them. A harm
 * reaches the character only if they witness the event — there where it
 * happens, or it happens everywhere; what it dealt comes back for the trace.
 */
export async function applyEvent(
  target: EffectTarget,
  event: ScenarioEvent,
  witnessed: boolean,
  client?: QueryClientContract
): Promise<TracedHarm[]> {
  const harm: TracedHarm[] = []

  for (const effect of event.effects) {
    if (effect.type === 'character_harmed') {
      const dealt = witnessed ? await harmCharacter(target, effect.damage, client) : null
      if (dealt !== null) harm.push(dealt)
      continue
    }

    await applyEffect(target, effect, event.reference, client)
  }

  return harm
}

/**
 * The author's dice, less the best armour the character wears, never below
 * zero hit points. Hurt, they may be tended, and begin to heal — as after a
 * blow.
 */
async function harmCharacter(
  target: EffectTarget,
  damage: string,
  client?: QueryClientContract
): Promise<TracedHarm | null> {
  if (target.harm === null || target.characterId === null) {
    return null
  }

  const { rules, characterState: state } = target.harm
  const held = await characterItems(target.sessionId, target.characterId, client)
  const worn = held.filter(({ equipped }) => equipped)
  const dealt = rules.harm(damage, armorOf(target.world, worn))

  if (dealt.total > 0) {
    state.hitPoints = Math.max(0, state.hitPoints - dealt.total)
    state.firstAidAvailable = true
    if (state.healingSince === null && target.worldState !== null) {
      state.healingSince = target.worldState.gameTime
    }
    if (client?.isTransaction) state.useTransaction(client as TransactionClientContract)
    await state.save()
  }

  return { damage, ...dealt }
}

/** What became of an event, written once per game: armed, then set off or cancelled. */
export async function recordEvent(
  sessionId: string,
  reference: string,
  progress: Partial<
    Pick<EventState, 'armedAt' | 'firedAt' | 'cancelledAt' | 'turnNumber' | 'witnessed' | 'told'>
  >,
  client?: QueryClientContract
): Promise<void> {
  await EventState.updateOrCreate({ sessionId, eventReference: reference }, progress, { client })
}

/** The events of earlier turns a narration just told: told once only. */
export async function markTold(
  sessionId: string,
  references: string[],
  client?: QueryClientContract
): Promise<void> {
  if (references.length === 0) {
    return
  }

  await EventState.query({ client })
    .where('sessionId', sessionId)
    .whereIn('eventReference', references)
    .update({ told: true })
}

/**
 * The events the state sets off once a turn is applied, pass after pass —
 * one may set off another — up to `EVENT_CHAIN_DEPTH`. Past it, what is still
 * due waits for the end of the next turn, its conditions still holding: the
 * turn never fails for it. Those set off are told on the next turn.
 */
export async function settleStateEvents(
  target: EffectTarget & { worldState: WorldState },
  turn: { gameTime: number; turnNumber: number; around: () => Promise<string[]> },
  client?: QueryClientContract
): Promise<{ settled: SettledStateEvent[]; deferred: string[] }> {
  const settled: SettledStateEvent[] = []

  for (let pass = 0; ; pass++) {
    const rows = await loadProgress(target.sessionId, client)
    const snapshot = await loadSnapshot(target.world, target.sessionId, target.worldState, client)
    const due = stateEventsDue(target.world.events, progressReader(rows), snapshot)
    const count = due.fire.length + due.arm.length + due.cancel.length

    if (count === 0) {
      return { settled, deferred: [] }
    }

    if (pass >= EVENT_CHAIN_DEPTH) {
      return {
        settled,
        deferred: [...due.fire, ...due.arm, ...due.cancel].map(({ reference }) => reference),
      }
    }

    const around = await turn.around()

    for (const event of due.arm) {
      await recordEvent(target.sessionId, event.reference, { armedAt: turn.gameTime }, client)
      settled.push({ event: event.reference, outcome: 'armed', witnessed: false })
    }
    for (const event of due.cancel) {
      await recordEvent(
        target.sessionId,
        event.reference,
        { cancelledAt: turn.gameTime, turnNumber: turn.turnNumber },
        client
      )
      settled.push({ event: event.reference, outcome: 'cancelled', witnessed: false })
    }
    for (const event of due.fire) {
      const witnessed = witnesses(event, around)

      await recordEvent(
        target.sessionId,
        event.reference,
        { firedAt: turn.gameTime, turnNumber: turn.turnNumber, witnessed, told: false },
        client
      )
      const harm = await applyEvent(target, event, witnessed, client)
      settled.push({
        event: event.reference,
        outcome: 'fired',
        witnessed,
        ...(harm.length > 0 ? { harm } : {}),
      })
    }
  }
}

/**
 * A unique person sent to a unique place: present if the character stands
 * there, waiting there otherwise — and, for a place never visited, waiting
 * for its first visit, gone from wherever they were meanwhile.
 */
async function moveNpc(
  target: EffectTarget,
  reference: string,
  location: string,
  source: { effect: EventEffect; event: string },
  client?: QueryClientContract
): Promise<void> {
  const { world, sessionId } = target
  const definition = uniqueNpc(world, reference)

  await dropPendingMoves(sessionId, reference, client)

  const npc = await npcOf(sessionId, reference, client)

  if (npc?.status === 'dead' || npc?.status === 'dying') {
    return
  }

  const place = await placeOf(sessionId, location, client)

  if (place === null) {
    if (npc !== null) {
      npc.merge({ status: 'absent', locationInstanceId: null })
      await npc.save()
    }

    return addPending(sessionId, [{ waitsFor: { location }, ...source }], client)
  }

  const status = statusIn(target, place)

  if (npc === null) {
    await placeNpc(world, sessionId, definition, { status, place: place.id }, client)
    return
  }

  npc.merge({ status, locationInstanceId: place.id })
  await npc.save()
}

/**
 * An item brought to someone or somewhere: a new copy of an archetype, or a
 * unique one — created the first time, handed over wherever it was after
 * that. A unique item destroyed stays destroyed.
 */
async function placeItem(
  target: EffectTarget,
  reference: string,
  to: { holder: 'character' } | ItemHolderReference,
  quantity: number,
  source: { effect: EventEffect; event: string },
  client?: QueryClientContract
): Promise<void> {
  const { world, sessionId } = target
  const holder = await holderOf(target, to, client)

  if (holder === 'nobody') {
    return
  }

  if (holder === 'pending') {
    const waitsFor =
      to.holder === 'npc'
        ? { npc: to.reference }
        : { location: (to as ItemHolderReference).reference }

    return addPending(sessionId, [{ waitsFor, ...source }], client)
  }

  const definition = world.items.find((item) => item.reference === reference)

  if (definition?.kind === 'unique') {
    const existing = await uniqueItemOf(sessionId, reference, client)

    if (existing !== null) {
      if (existing.state !== 'gone') {
        await transferItem(world, existing, holder, existing.quantity, client)
      }
      return
    }

    await createItem(
      world,
      sessionId,
      { definition: reference, descriptor: null, quantity: 1 },
      holder,
      client
    )
    return
  }

  await createItem(
    world,
    sessionId,
    { definition: reference, descriptor: null, quantity },
    holder,
    client
  )
}

/** Who an item goes to: someone or somewhere the game has met, or a wait for them. */
async function holderOf(
  target: EffectTarget,
  to: { holder: 'character' } | ItemHolderReference,
  client?: QueryClientContract
): Promise<Holder | 'pending' | 'nobody'> {
  if (to.holder === 'character') {
    return target.characterId === null ? 'nobody' : { type: 'character', id: target.characterId }
  }

  if (to.holder === 'npc') {
    const npc = await npcOf(target.sessionId, to.reference, client)

    if (npc === null) {
      return 'pending'
    }

    return npc.status === 'dead' ? 'nobody' : { type: 'npc', id: npc.id }
  }

  const place = await placeOf(target.sessionId, to.reference, client)

  return place === null ? 'pending' : { type: 'location', id: place.id }
}

function statusIn(target: EffectTarget, place: LocationInstance): 'present' | 'absent' {
  return place.id === target.placeId ? 'present' : 'absent'
}

function uniqueNpc(world: WorldDefinition, reference: string) {
  const definition = world.npcs.find((npc) => npc.reference === reference)

  if (definition?.kind !== 'unique') {
    throw new Error(`"${reference}" is no unique person of the ${world.reference} world.`)
  }

  return definition
}

/** The instance of a unique place, if the game has been there: its handle is its reference. */
function placeOf(sessionId: string, reference: string, client?: QueryClientContract) {
  return LocationInstance.query({ client })
    .where('sessionId', sessionId)
    .where('handle', reference)
    .first()
}

function npcOf(sessionId: string, handle: string, client?: QueryClientContract) {
  return NpcInstance.query({ client }).where('sessionId', sessionId).where('handle', handle).first()
}

function uniqueItemOf(sessionId: string, reference: string, client?: QueryClientContract) {
  return InventoryItem.query({ client })
    .where('sessionId', sessionId)
    .where('handle', reference)
    .first()
}

/**
 * Where the schedules put people once a turn is over (roadmap, Phase 11):
 *
 * - someone away from the scene goes where the entry of the period sends
 *   them — a place never visited leaves them nowhere known until it is;
 * - someone in the scene stays, unless the entry of the period takes them
 *   away from it (`leavesScene`);
 * - someone the game has not met is brought in only where the character
 *   stands, if their schedule has them there: anywhere else, where they are
 *   is read from the schedule when needed.
 *
 * A period no entry covers leaves everyone where they are. Whoever this
 * brings where the character stands is present.
 */
export async function followSchedules(
  target: {
    world: WorldDefinition
    sessionId: string
    /** Where the character stands, as an instance and as a unique place's reference if it is one. */
    place: { id: string; reference: string | null } | null
  },
  clock: { gameTime: number; stopped: Set<string> },
  client?: QueryClientContract
): Promise<void> {
  const { world, sessionId, place: here } = target
  const sent = await pendingNpcs(sessionId, client)

  for (const definition of scheduledNpcs(world, clock.stopped)) {
    const npc = await npcOf(sessionId, definition.reference, client)

    if (npc === null) {
      const expected = expectedPlaceOf(definition, clock)

      if (
        here !== null &&
        expected !== null &&
        expected === here.reference &&
        !sent.has(definition.reference)
      ) {
        await placeNpc(world, sessionId, definition, { status: 'present', place: here.id }, client)
      }
      continue
    }

    if (npc.status === 'dead' || npc.status === 'dying') {
      continue
    }

    const entry = entryAt(definition.schedule, clock.gameTime)

    if (entry === null) {
      continue
    }

    if (npc.status === 'present' && (!entry.leavesScene || entry.location === here?.reference)) {
      continue
    }

    const place = await placeOf(sessionId, entry.location, client)
    const status = place !== null && place.id === here?.id ? 'present' : 'absent'

    if (npc.locationInstanceId !== (place?.id ?? null) || npc.status !== status) {
      npc.merge({ status, locationInstanceId: place?.id ?? null })
      await npc.save()
    }
  }
}
