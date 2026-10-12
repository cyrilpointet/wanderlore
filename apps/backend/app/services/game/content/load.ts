import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import Scenario from '#models/scenario'
import type { WorldDefinition } from '#services/game/world'

import type { ScenarioContent } from './types.js'
import { resolveWorld, type WorldLevelContent } from './resolve.js'
import { readWorldLevel, scenarioContentOf } from './store.js'

/** What names a game's content: its world and the scenario it was started from. */
export type GameContentRef = {
  worldId: string
  scenarioId: string
}

/** The content a game is played with, as stored: its world's, and its scenario's. */
export type GameContent = {
  world: WorldLevelContent
  scenario: ScenarioContent
}

/** A game's world and scenario, read as they stand in the database right now. */
export async function loadContent(
  ref: GameContentRef,
  client?: QueryClientContract
): Promise<GameContent> {
  const scenario = await Scenario.query({ client })
    .where('id', ref.scenarioId)
    .where('worldId', ref.worldId)
    .firstOrFail()

  const world = await readWorldLevel(ref.worldId, client)

  return { world, scenario: await scenarioContentOf(scenario, client) }
}

/**
 * The world a game is played in, as it stands in the database right now:
 * the world's content and its scenario's, resolved into one definition.
 *
 * No cache. A turn calls it once, when it is picked up, and hands the result
 * to every step: content edited while the turn plays reaches the next turn,
 * never the rest of this one.
 */
export async function loadWorld(
  ref: GameContentRef,
  client?: QueryClientContract
): Promise<WorldDefinition> {
  const { world, scenario } = await loadContent(ref, client)

  return resolveWorld(world, scenario)
}

/**
 * The worlds of several games, each loaded once however many games share it:
 * a list of games can span worlds and scenarios.
 */
export async function loadWorlds(
  refs: GameContentRef[],
  client?: QueryClientContract
): Promise<(ref: GameContentRef) => WorldDefinition> {
  const keyOf = (ref: GameContentRef) => `${ref.worldId}/${ref.scenarioId}`
  const distinct = new Map(refs.map((ref) => [keyOf(ref), ref]))
  const loaded = new Map<string, WorldDefinition>()

  for (const [key, ref] of distinct) {
    loaded.set(key, await loadWorld(ref, client))
  }

  return (ref) => {
    const world = loaded.get(keyOf(ref))

    if (!world) {
      throw new Error(`World of scenario ${ref.scenarioId} was not loaded.`)
    }

    return world
  }
}
