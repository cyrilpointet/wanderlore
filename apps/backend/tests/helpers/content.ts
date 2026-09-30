import db from '@adonisjs/lucid/services/db'

import ResolutionRulesSeeder from '#database/seeders/01_resolution_rules_seeder'

/**
 * Writes the game content a turn reads, through the very seeder every
 * environment runs, so the functional suite plays against the real rules.
 *
 * Called by the tests that need it rather than seeded globally: an implicit
 * fixture would hide which tests depend on it.
 */
export async function seedResolutionRules(): Promise<void> {
  await new ResolutionRulesSeeder(db.connection()).run()
}
