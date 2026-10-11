import { randomUUID } from 'node:crypto'

import type TurnLog from '#models/turn_log'
import type { TurnService } from '#services/game/turn_service'

export type PlayInput = {
  sessionId: string
  userId: string
  playerInput: string
}

/**
 * Records a turn the way a submission does — a fresh key each time — then
 * plays it straight away, as the worker would, and returns it as logged.
 *
 * Skips the queue on purpose: these specs are about the pipeline. The queue
 * has specs of its own.
 */
export function playerOf(service: TurnService) {
  return async (input: PlayInput): Promise<TurnLog> => {
    const { turn } = await service.record({ ...input, idempotencyKey: randomUUID() })

    return service.run(turn.id)
  }
}

/** A holder as the model names it: the handle only matters for someone present. */
export type WireHolder = { holder: 'character' | 'npc' | 'location'; handle: string | null }

export const CHARACTER: WireHolder = { holder: 'character', handle: null }
export const LOCATION: WireHolder = { holder: 'location', handle: null }
export const npc = (handle: string): WireHolder => ({ holder: 'npc', handle })

type WireMovement = {
  location: string | null
  definition: string | null
  parent: string | null
  descriptor: string | null
  name: string | null
}

/**
 * An extraction answer as the model sends it, every field present: a spec
 * names only what it is about. A movement given as a string is a named place;
 * given as an object, a new place of an archetype.
 */
export function extracted(
  answer: {
    movement?: string | Partial<WireMovement> | null
    npcs_entered?: { definition: string; descriptor: string | null; name?: string | null }[]
    npcs_left?: string[]
    npcs_following?: string[]
    npc_names?: { handle: string; name: string }[]
    npc_relations?: { handle: string; disposition: string }[]
    scenario_flags?: string[]
    hit_points_delta?: number
    items_created?: {
      definition: string
      descriptor: string | null
      quantity: number
      holder: WireHolder
      equipped: boolean
    }[]
    items_transferred?: { item: string; from: WireHolder; to: WireHolder; quantity: number }[]
    items_destroyed?: { item: string; holder: WireHolder; quantity: number }[]
    items_equipped?: string[]
    items_unequipped?: string[]
  } = {}
) {
  const { movement = null, ...rest } = answer
  const none: WireMovement = {
    location: null,
    definition: null,
    parent: null,
    descriptor: null,
    name: null,
  }

  return {
    movement:
      movement === null
        ? null
        : typeof movement === 'string'
          ? { ...none, location: movement }
          : { ...none, ...movement },
    npcs_entered: [],
    npcs_left: [],
    npcs_following: [],
    npc_names: [],
    npc_relations: [],
    scenario_flags: [],
    hit_points_delta: 0,
    items_created: [],
    items_transferred: [],
    items_destroyed: [],
    items_equipped: [],
    items_unequipped: [],
    ...rest,
  }
}
