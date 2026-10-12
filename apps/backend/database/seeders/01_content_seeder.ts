import { BaseSeeder } from '@adonisjs/lucid/seeders'

import { storeWorldContent } from '#services/game/content/store'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'

/**
 * The worlds written in code, with their scenarios, catalogues and categories
 * of action. Game content rather than a fixture: a game cannot be played
 * without it, so the seeder runs in every environment, unlike the test
 * account.
 *
 * Idempotent, matched on references: see `storeWorldContent`. The content of
 * these worlds belongs to the code — edits made to them elsewhere are
 * overwritten by the next seed.
 */
export const SEEDED_WORLDS = [THREE_MUSKETEERS_CONTENT]

export default class extends BaseSeeder {
  async run() {
    await this.client.transaction(async (trx) => {
      for (const world of SEEDED_WORLDS) {
        await storeWorldContent(world, trx)
      }
    })
  }
}
