import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'

/**
 * Test account used to exercise the game loop before self-service signup exists
 * (see roadmap, Phase 0 — signup only lands in Phase 9).
 *
 * Restricted to local environments so these credentials can never reach a
 * deployed database.
 */
export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    await User.updateOrCreate(
      { email: 'player@wanderlore.test' },
      {
        fullName: 'Test Player',
        password: 'password',
        role: 'player',
      }
    )
  }
}
