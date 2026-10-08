import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import NpcInstance from '#models/npc_instance'
import type Character from '#models/character'
import type WorldState from '#models/world_state'
import type LocationInstance from '#models/location_instance'

import { DeadNpcError, enterScene } from './npcs.js'
import { improviseLocation, visitUniqueLocation } from './locations.js'
import type { WorldDefinition } from './world.js'
import type { AppliedEffects, Movement, PlacedMovement, TurnEffects } from './prompts/types.js'

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
 * 3. entrances;
 * 4. names learnt and dispositions.
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
  const movement = await move(target, effects.movement, effects.npcs_following, trx)

  const left = await leave(target.sessionId, effects.npcs_left, trx)
  const entered = await enter(target, effects.npcs_entered, trx)
  await learn(target.sessionId, effects, trx)

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

  /** Null rather than missing: an instance just created leaves unset columns undefined. */
  return {
    handle: destination.handle,
    definitionReference: destination.definitionReference,
    parentReference: destination.parentReference ?? null,
    name: destination.name ?? null,
  }
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
