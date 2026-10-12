import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'

/**
 * Test account for the back-office, until accounts are administered from it
 * (roadmap, Phase 5bis).
 *
 * Restricted to local environments so these credentials can never reach a
 * deployed database.
 */
export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    await User.updateOrCreate(
      { email: 'gm@wanderlore.test' },
      {
        fullName: 'Test Game Master',
        password: 'password',
        role: 'game_master',
      }
    )
  }
}
