import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import NpcInstance from '#models/npc_instance'
import InventoryItem from '#models/inventory_item'
import type CharacterState from '#models/character_state'
import { HEALING_PERIOD, healingWeeks, type RulesEngine } from '#services/rules/engine'

import { enterScene } from './npcs.js'
import { type Holder, destroyItem, leaveItemsInPlace, transferItem } from './inventory.js'
import type { HeldItem } from './inventory.js'
import type { TracedFirstAid, TracedRound } from './turn_trace.js'
import type { WorldDefinition } from './world.js'

/**
 * What a round of combat, first aid and time do to the state (roadmap,
 * Phase 10), applied in the turn's transaction. Everything was worked out
 * before: here it is only written — through the services of the people and
 * of the inventory, never straight into their tables.
 */

export type CombatTarget = {
  world: WorldDefinition
  sessionId: string
  /** What the character lives through in this game: their hit points, their wounds. */
  characterState: CharacterState
  /** Where the turn began: where a dropped weapon falls, and the dying die. */
  placeId: string | null
}

/**
 * Those dying since an earlier turn die now, where they fell, and what they
 * held falls with them — unless first aid kept them alive this very turn.
 */
export async function letTheDyingDie(
  target: CombatTarget,
  spared: string | null,
  trx: TransactionClientContract
): Promise<string[]> {
  const dying = await NpcInstance.query({ client: trx })
    .where('sessionId', target.sessionId)
    .where('status', 'dying')
    .if(spared !== null, (query) => query.whereNot('handle', spared!))

  for (const npc of dying) {
    npc.status = 'dead'
    npc.bleeding = false
    await npc.useTransaction(trx).save()

    if (npc.locationInstanceId !== null) {
      await leaveItemsInPlace(target.world, npc.id, npc.locationInstanceId, trx)
    }
  }

  return dying.map(({ handle }) => handle)
}

/**
 * The round, as played: an improvised opponent brought in under the handle
 * the round gave them, hit points and bleeding on both sides — and of another
 * hostile who struck back in the opponent's place — a person dying or dead,
 * the weapons dropped or broken.
 */
export async function applyRound(
  target: CombatTarget,
  round: TracedRound,
  trx: TransactionClientContract
): Promise<void> {
  if (round.provisional !== null) {
    await enterScene(
      target.world,
      target.sessionId,
      { definition: round.provisional.definition, descriptor: null },
      trx,
      target.placeId
    )
  }

  const opponent = await NpcInstance.query({ client: trx })
    .where('sessionId', target.sessionId)
    .where('handle', round.opponent)
    .firstOrFail()

  const { characterState: state } = target
  state.hitPoints = Math.min(state.hitPointsMax, round.character.hitPoints)
  state.bleeding = round.character.bleeding
  if (round.character.damage > 0) state.firstAidAvailable = true
  await state.useTransaction(trx).save()

  const after = round.opponentAfter
  opponent.hitPoints = after.hitPoints
  opponent.bleeding = after.state === 'dead' ? false : after.bleeding
  if (after.damage > 0) opponent.firstAidAvailable = true
  if (after.state === 'dying' || after.state === 'dead') opponent.status = after.state
  await opponent.useTransaction(trx).save()

  /** Another hostile who struck back in the opponent's place, hurt by their own fumble. */
  const riposter =
    round.riposte !== null && round.riposte.by !== round.opponent
      ? await NpcInstance.query({ client: trx })
          .where('sessionId', target.sessionId)
          .where('handle', round.riposte.by)
          .firstOrFail()
      : null

  if (riposter !== null && round.riposterAfter !== null) {
    riposter.hitPoints = round.riposterAfter.hitPoints
    if (round.riposterAfter.damage > 0) riposter.firstAidAvailable = true
    if (round.riposterAfter.state === 'dying') riposter.status = 'dying'
    await riposter.useTransaction(trx).save()
  }

  for (const lost of round.lostWeapons) {
    const holder: Holder =
      lost.holder === 'character'
        ? { type: 'character', id: state.characterId }
        : { type: 'npc', id: lost.holder === 'riposter' ? riposter!.id : opponent.id }
    const item = await heldCopy(target.sessionId, lost.item, holder, trx)

    if (item === null) continue

    if (lost.fate === 'broken') {
      await destroyItem(target.world, item, item.quantity)
    } else if (target.placeId !== null) {
      await transferItem(
        target.world,
        item,
        { type: 'location', id: target.placeId },
        item.quantity,
        trx
      )
    }
  }

  if (after.state === 'dead' && opponent.locationInstanceId !== null) {
    await leaveItemsInPlace(target.world, opponent.id, opponent.locationInstanceId, trx)
  }
}

/**
 * First aid, as rolled: hit points given back — or one lost on a fumble —
 * the wound tended for good, and on a success a bleeding stopped and a dying
 * person kept alive, at 1 hit point at least.
 */
export async function applyFirstAid(
  target: CombatTarget,
  aid: TracedFirstAid,
  trx: TransactionClientContract
): Promise<void> {
  if (!aid.available) {
    return
  }

  if (aid.target === null) {
    const { characterState: state } = target
    state.hitPoints = Math.max(0, Math.min(state.hitPointsMax, state.hitPoints + aid.healed))
    state.firstAidAvailable = false
    if (aid.saved) state.bleeding = false
    await state.useTransaction(trx).save()

    return
  }

  const npc = await NpcInstance.query({ client: trx })
    .where('sessionId', target.sessionId)
    .where('handle', aid.target)
    .firstOrFail()
  const definition = target.world.npcs.find(
    ({ reference }) => reference === npc.definitionReference
  )
  const max = definition?.combat.hitPointsMax ?? Number.POSITIVE_INFINITY
  const healed = Math.min(max, (npc.hitPoints ?? 0) + aid.healed)

  npc.firstAidAvailable = false
  if (aid.saved) {
    npc.bleeding = false
    npc.hitPoints = Math.max(1, healed)
    if (npc.status === 'dying') npc.status = 'present'
  } else {
    npc.hitPoints = healed
  }
  await npc.useTransaction(trx).save()
}

/** A fight over, nobody bleeds on: the book's bleeding stops once held for a while. */
export async function stopBleeding(
  target: CombatTarget,
  trx: TransactionClientContract
): Promise<void> {
  if (target.characterState.bleeding) {
    target.characterState.bleeding = false
    await target.characterState.useTransaction(trx).save()
  }

  await NpcInstance.query({ client: trx })
    .where('sessionId', target.sessionId)
    .where('bleeding', true)
    .update({ bleeding: false })
}

/**
 * Natural healing, on the game clock: 1D3 for every whole week since the
 * character began healing, counted from the first wound taken at full hit
 * points; nothing to count once they are whole again. A harm read by
 * extraction makes the wound tendable, as a blow does.
 */
export async function heal(
  rules: RulesEngine,
  character: CharacterState,
  clock: { after: number },
  /** Hurt this turn by what extraction read — a fall, a burn — rather than by a blow. */
  harmed: boolean,
  trx: TransactionClientContract
): Promise<void> {
  if (harmed) {
    character.firstAidAvailable = true
  }

  if (character.healingSince !== null && character.hitPoints < character.hitPointsMax) {
    const weeks = healingWeeks(character.healingSince, clock.after)

    if (weeks > 0) {
      character.hitPoints = Math.min(
        character.hitPointsMax,
        character.hitPoints + rules.naturalHealing(weeks)
      )
      character.healingSince += weeks * HEALING_PERIOD
    }
  }

  if (character.hitPoints >= character.hitPointsMax) {
    character.healingSince = null
  } else if (character.healingSince === null) {
    character.healingSince = clock.after
  }

  await character.useTransaction(trx).save()
}

/** The copy a fumble lost: by its handle, or the stack of its definition the holder has. */
async function heldCopy(
  sessionId: string,
  item: HeldItem,
  holder: Holder,
  trx: TransactionClientContract
): Promise<InventoryItem | null> {
  const column = { character: 'characterId', npc: 'npcInstanceId', location: 'locationInstanceId' }[
    holder.type
  ]
  const query = InventoryItem.query({ client: trx })
    .where('sessionId', sessionId)
    .where(column, holder.id)
    .whereNot('state', 'gone')

  return item.handle === null
    ? query.where('definitionReference', item.definition).whereNull('handle').first()
    : query.where('handle', item.handle).first()
}
