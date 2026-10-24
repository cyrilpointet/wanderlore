import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'

/**
 * Test account for the account screens of the back-office. Anywhere else, the
 * first superadmin comes from `node ace account:create-superadmin`.
 *
 * Restricted to local environments so these credentials can never reach a
 * deployed database.
 */
export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    await User.updateOrCreate(
      { email: 'admin@wanderlore.test' },
      {
        fullName: 'Test Superadmin',
        password: 'password',
        role: 'superadmin',
        suspendedAt: null,
      }
    )
  }
}
