import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import WorldState from '#models/world_state'

import { applyEffect } from './apply_events.js'
import type { EventEffect } from './content/types.js'
import type { WorldDefinition } from './world.js'

/**
 * What an event placed where the game has never been, or with someone it has
 * never met (roadmap, Phase 11): neither has an instance to hold it yet, and
 * creating one would mark the place visited, the person met. The effect waits
 * in `world_states.pending_place_effects`, and is applied when they come into
 * being — on the first visit, at the first meeting.
 *
 * Written here only, through queries of its own: the turn's copy of the
 * state never carries this column, so saving it cannot undo what waits.
 */

export type PendingEffect = {
  /** The first visit of a unique place, or the first meeting of a unique person. */
  waitsFor: { location: string } | { npc: string }
  effect: EventEffect
  /** The event it comes from, for whoever reads the state. */
  event: string
}

export async function addPending(
  sessionId: string,
  entries: PendingEffect[],
  client?: QueryClientContract
): Promise<void> {
  if (entries.length === 0) {
    return
  }

  const state = await stateOf(sessionId, client)

  if (state !== null) {
    await save(state, [...state.pendingPlaceEffects, ...entries], client)
  }
}

/** Everything that waits, in the order it was placed. */
export async function pendingOf(
  sessionId: string,
  client?: QueryClientContract
): Promise<PendingEffect[]> {
  const state = await stateOf(sessionId, client)

  return state?.pendingPlaceEffects ?? []
}

/** The unique people an event sent somewhere before the game met them: they are where it sent them. */
export async function pendingNpcs(
  sessionId: string,
  client?: QueryClientContract
): Promise<Set<string>> {
  const pending = await pendingOf(sessionId, client)

  return new Set(pending.flatMap(({ effect }) => (isMove(effect) ? [effect.npc] : [])))
}

/**
 * Forgets where an earlier event sent someone, before they are sent again:
 * the last word is the latest one.
 */
export async function dropPendingMoves(
  sessionId: string,
  npc: string,
  client?: QueryClientContract
): Promise<void> {
  const state = await stateOf(sessionId, client)

  if (state === null) {
    return
  }

  const kept = state.pendingPlaceEffects.filter(
    ({ effect }) => !(isMove(effect) && effect.npc === npc)
  )

  if (kept.length !== state.pendingPlaceEffects.length) {
    await save(state, kept, client)
  }
}

/**
 * Applies what waited for a place visited, or a person met, for the first
 * time — then forgets it. Whoever an event sent there waits there, absent,
 * until the character arrives.
 */
export async function bringPending(
  world: WorldDefinition,
  sessionId: string,
  waitsFor: { location: string } | { npc: string },
  client?: QueryClientContract
): Promise<void> {
  const state = await stateOf(sessionId, client)

  if (state === null || state.pendingPlaceEffects.length === 0) {
    return
  }

  const matches = (entry: PendingEffect) =>
    'location' in waitsFor
      ? 'location' in entry.waitsFor && entry.waitsFor.location === waitsFor.location
      : 'npc' in entry.waitsFor && entry.waitsFor.npc === waitsFor.npc
  const due = state.pendingPlaceEffects.filter(matches)

  if (due.length === 0) {
    return
  }

  await save(
    state,
    state.pendingPlaceEffects.filter((entry) => !matches(entry)),
    client
  )

  for (const entry of due) {
    await applyEffect(
      { world, sessionId, worldState: null, characterId: null, placeId: null },
      entry.effect,
      entry.event,
      client
    )
  }
}

function isMove(effect: EventEffect): effect is Extract<EventEffect, { npc: string }> & {
  type: 'npc_moved' | 'npc_entered'
} {
  return effect.type === 'npc_moved' || effect.type === 'npc_entered'
}

async function stateOf(sessionId: string, client?: QueryClientContract) {
  return WorldState.query({ client }).where('sessionId', sessionId).first()
}

async function save(
  state: WorldState,
  entries: PendingEffect[],
  client?: QueryClientContract
): Promise<void> {
  await WorldState.query({ client })
    .where('id', state.id)
    .update({ pendingPlaceEffects: JSON.stringify(entries) })
}
