import { resolveWorld } from '#services/game/content/resolve'
import type { WorldDefinition } from '#services/game/world'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'

/**
 * *The Three Musketeers* as a turn reads it, resolved from the content the
 * seeder writes — for the specs that hand a world to a service directly,
 * without the database. A turn loads its own from the database.
 */
export const THREE_MUSKETEERS: WorldDefinition = resolveWorld(
  THREE_MUSKETEERS_CONTENT,
  THREE_MUSKETEERS_CONTENT.scenarios[0]
)
