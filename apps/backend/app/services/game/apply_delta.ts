import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import NpcInstance from '#models/npc_instance'
import InventoryItem from '#models/inventory_item'
import type Character from '#models/character'
import type WorldState from '#models/world_state'
import type LocationInstance from '#models/location_instance'

import { DeadNpcError, enterScene } from './npcs.js'
import { improviseLocation, visitUniqueLocation } from './locations.js'
import {
  type Holder,
  createItem,
  destroyItem,
  equipItem,
  transferItem,
  unequipItem,
} from './inventory.js'
import type { WorldDefinition } from './world.js'
import type {
  AppliedEffects,
  AppliedHolder,
  AppliedItems,
  ItemHolderRef,
  Movement,
  PlacedMovement,
  TurnEffects,
} from './prompts/types.js'

/** What the delta is applied to: the game's state, inside the turn's transaction. */
export type DeltaTarget = {
  world: WorldDefinition
  sessionId: string
  character: Character
  /** With its `currentLocation` preloaded. */
  worldState: WorldState
}

/**
 * Applies the validated delta of a turn. Everything here is deterministic: the
 * model proposed, the backend decides what actually changes.
 *
 * The order is fixed, so an entrance at the new place is never undone by the
 * move that led there:
 *
 * 1. movement — and everyone present who does not follow is left behind;
 * 2. exits;
 * 3. entrances — a unique character met for the first time, like a unique
 *    place first visited, brings the items they hold from the start;
 * 4. names learnt and dispositions;
 * 5. items: creations, hand-overs, destructions, then what is drawn or put
 *    away. "The location" is the place the turn began in, whatever the
 *    movement: it is the only place whose items extraction was shown.
 *
 * Returns what actually changed, which can be less than what was proposed: a
 * hit point swing clamped at zero, a "movement" to where the character already
 * stands, a dead character who cannot walk back in.
 */
export async function applyDelta(
  target: DeltaTarget,
  effects: TurnEffects,
  trx: TransactionClientContract
): Promise<AppliedEffects> {
  const hitPointsDelta = await applyHitPoints(target.character, effects.hit_points_delta, trx)
  const startedIn = target.worldState.currentLocation as LocationInstance | null
  const movement = await move(target, effects.movement, effects.npcs_following, trx)

  const left = await leave(target.sessionId, effects.npcs_left, trx)
  const entered = await enter(target, effects.npcs_entered, trx)
  await learn(target.sessionId, effects, trx)
  const items = await applyItems(target, effects, startedIn, trx)

  applyFlags(target.worldState, effects.scenario_flags)
  await target.worldState.useTransaction(trx).save()

  return {
    movement,
    scenario_flags: effects.scenario_flags,
    hit_points_delta: hitPointsDelta,
    npcs_entered: entered,
    npcs_left: left,
    npc_names: effects.npc_names,
    npc_relations: effects.npc_relations,
    items,
  }
}

/**
 * Through the rules of the inventory, on the scene as the turn began — which
 * validation already checked every change against. A refusal here is a bug
 * upstream, and fails the turn rather than half-applying it.
 */
async function applyItems(
  target: DeltaTarget,
  effects: TurnEffects,
  startedIn: LocationInstance | null,
  trx: TransactionClientContract
): Promise<AppliedItems> {
  const applied: AppliedItems = {
    created: [],
    transferred: [],
    destroyed: [],
    equipped: [],
    unequipped: [],
  }
  const holders = new Map<string, { holder: Holder; applied: AppliedHolder }>()

  const resolve = async (ref: ItemHolderRef) => {
    const key = ref.holder === 'npc' ? `npc:${ref.handle}` : ref.holder
    const known = holders.get(key)

    if (known) {
      return known
    }

    let resolved: { holder: Holder; applied: AppliedHolder }

    if (ref.holder === 'character') {
      resolved = {
        holder: { type: 'character', id: target.character.id },
        applied: { holder: 'character' },
      }
    } else if (ref.holder === 'npc') {
      const npc = await NpcInstance.query({ client: trx })
        .where('sessionId', target.sessionId)
        .where('handle', ref.handle)
        .firstOrFail()
      resolved = {
        holder: { type: 'npc', id: npc.id },
        applied: {
          holder: 'npc',
          handle: npc.handle,
          definitionReference: npc.definitionReference,
          name: npc.name ?? null,
        },
      }
    } else {
      if (startedIn === null) {
        throw new Error('The turn began nowhere: no place can hold an item.')
      }
      resolved = {
        holder: { type: 'location', id: startedIn.id },
        applied: { holder: 'location', place: placed(startedIn) },
      }
    }

    holders.set(key, resolved)
    return resolved
  }

  /** A copy by its handle, a stack by its definition and who holds it. */
  const find = async (item: string, holder: Holder) => {
    const copy = await InventoryItem.query({ client: trx })
      .where('sessionId', target.sessionId)
      .where('handle', item)
      .first()

    if (copy !== null) {
      return copy
    }

    const column = {
      character: 'characterId',
      npc: 'npcInstanceId',
      location: 'locationInstanceId',
    }[holder.type]

    return InventoryItem.query({ client: trx })
      .where('sessionId', target.sessionId)
      .where(column, holder.id)
      .where('definitionReference', item)
      .whereNull('handle')
      .firstOrFail()
  }

  for (const entry of effects.items_created) {
    const { holder, applied: appliedHolder } = await resolve(entry.holder)
    const created = await createItem(
      target.world,
      target.sessionId,
      { definition: entry.definition, descriptor: entry.descriptor, quantity: entry.quantity },
      holder,
      trx
    )
    const item = created.handle ?? created.definitionReference

    applied.created.push({
      item,
      definition: entry.definition,
      quantity: entry.quantity,
      holder: appliedHolder,
    })

    if (entry.equipped) {
      await equipItem(target.world, created)
      applied.equipped.push({ item, definition: entry.definition })
    }
  }

  for (const entry of effects.items_transferred) {
    const from = await resolve(entry.from)
    const to = await resolve(entry.to)
    const item = await find(entry.item, from.holder)

    await transferItem(target.world, item, to.holder, entry.quantity, trx)
    applied.transferred.push({
      item: entry.item,
      definition: item.definitionReference,
      quantity: entry.quantity,
      from: from.applied,
      to: to.applied,
    })
  }

  for (const entry of effects.items_destroyed) {
    const holder = await resolve(entry.holder)
    const item = await find(entry.item, holder.holder)

    await destroyItem(target.world, item, entry.quantity)
    applied.destroyed.push({
      item: entry.item,
      definition: item.definitionReference,
      quantity: entry.quantity,
      holder: holder.applied,
    })
  }

  const character = { type: 'character' as const, id: target.character.id }

  for (const handle of effects.items_equipped) {
    const item = await find(handle, character)
    await equipItem(target.world, item)
    applied.equipped.push({ item: handle, definition: item.definitionReference })
  }

  for (const handle of effects.items_unequipped) {
    const item = await find(handle, character)
    await unequipItem(item)
    applied.unequipped.push({ item: handle, definition: item.definitionReference })
  }

  return applied
}

/** Null rather than missing: an instance just created leaves unset columns undefined. */
function placed(place: LocationInstance): PlacedMovement {
  return {
    handle: place.handle,
    definitionReference: place.definitionReference,
    parentReference: place.parentReference ?? null,
    name: place.name ?? null,
  }
}

/** Clamped rather than trusted: validation bounds the size of the swing, not where it lands. */
async function applyHitPoints(
  character: Character,
  delta: number,
  trx: TransactionClientContract
): Promise<number> {
  if (delta === 0) {
    return 0
  }

  const before = character.hitPoints
  character.hitPoints = Math.max(0, Math.min(character.hitPointsMax, before + delta))
  await character.useTransaction(trx).save()

  return character.hitPoints - before
}

/**
 * To a named place, its instance is created on the first visit and reused
 * after; to any other place, a new instance of its archetype. Changing place
 * leaves behind everyone present but those who follow.
 */
async function move(
  target: DeltaTarget,
  movement: Movement | null,
  following: string[],
  trx: TransactionClientContract
): Promise<PlacedMovement | null> {
  if (movement === null) {
    return null
  }

  const current = target.worldState.currentLocation as LocationInstance | null

  /** Going where one already stands is no movement, and nobody is left behind. */
  if ('location' in movement && movement.location === current?.handle) {
    return null
  }

  const destination =
    'location' in movement
      ? await visitUniqueLocation(target.world, target.sessionId, movement.location, trx)
      : await improviseLocation(target.world, target.sessionId, movement, trx)

  target.worldState.currentLocationId = destination.id

  await NpcInstance.query({ client: trx })
    .where('sessionId', target.sessionId)
    .where('status', 'present')
    .whereNotIn('handle', following)
    .update({ status: 'absent' })

  return placed(destination)
}

/** Someone who leaves is absent, never deleted: they may be met again. */
async function leave(
  sessionId: string,
  handles: string[],
  trx: TransactionClientContract
): Promise<string[]> {
  if (handles.length === 0) {
    return []
  }

  await NpcInstance.query({ client: trx })
    .where('sessionId', sessionId)
    .whereIn('handle', handles)
    .update({ status: 'absent' })

  return handles
}

/**
 * Through the instancing rules: a unique character met before comes back, an
 * archetype gets a new instance. A dead one is refused — not applied, and the
 * rest of the turn goes on.
 */
async function enter(
  target: DeltaTarget,
  entries: TurnEffects['npcs_entered'],
  trx: TransactionClientContract
): Promise<string[]> {
  const handles: string[] = []

  for (const entry of entries) {
    try {
      const npc = await enterScene(target.world, target.sessionId, entry, trx)
      handles.push(npc.handle)
    } catch (error) {
      if (!(error instanceof DeadNpcError)) {
        throw error
      }
    }
  }

  return handles
}

async function learn(
  sessionId: string,
  effects: Pick<TurnEffects, 'npc_names' | 'npc_relations'>,
  trx: TransactionClientContract
): Promise<void> {
  for (const { handle, name } of effects.npc_names) {
    await NpcInstance.query({ client: trx })
      .where('sessionId', sessionId)
      .where('handle', handle)
      .update({ name })
  }

  /** The disposition proposed is the new one itself: set, never adjusted. */
  for (const { handle, disposition } of effects.npc_relations) {
    await NpcInstance.query({ client: trx })
      .where('sessionId', sessionId)
      .where('handle', handle)
      .update({ disposition })
  }
}

function applyFlags(worldState: WorldState, flags: string[]): void {
  if (flags.length === 0) {
    return
  }

  worldState.narrativeFlags = {
    ...worldState.narrativeFlags,
    ...Object.fromEntries(flags.map((flag) => [flag, true])),
  }
}
