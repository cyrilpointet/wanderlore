import { BaseSeeder } from '@adonisjs/lucid/seeders'

import ResolutionRule from '#models/resolution_rule'
import { RESOLUTION_RULES } from '#services/game/resolution_rule_content'

/**
 * Game content rather than a fixture: a turn cannot resolve a roll without
 * these rows, so the seeder runs in every environment, unlike the test
 * account.
 *
 * Idempotent: rows are matched on `(world_reference, action_type)`, inserted
 * or updated from the code. A category removed from the code is removed from
 * the table too, or arbitration would keep being offered it.
 */
export default class extends BaseSeeder {
  async run() {
    await this.client.transaction(async (trx) => {
      for (const { world, rules } of RESOLUTION_RULES) {
        await ResolutionRule.updateOrCreateMany(
          ['worldReference', 'actionType'],
          rules.map((rule) => ({ worldReference: world.reference, ...rule })),
          { client: trx }
        )

        await ResolutionRule.query({ client: trx })
          .where('worldReference', world.reference)
          .whereNotIn(
            'actionType',
            rules.map((rule) => rule.actionType)
          )
          .delete()
      }
    })
  }
}
