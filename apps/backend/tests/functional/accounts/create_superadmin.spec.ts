import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import ace from '@adonisjs/core/services/ace'
import hash from '@adonisjs/core/services/hash'

import CreateSuperadmin from '../../../commands/create_superadmin.js'
import SuperadminSeeder from '#database/seeders/04_test_superadmin_seeder'
import { countRows, createUser, useTransaction } from '#tests/helpers/database'

async function run(args: string[], replies: Record<string, string> = {}) {
  const command = await ace.create(CreateSuperadmin, args)
  command.ui.switchMode('raw')

  for (const [prompt, reply] of Object.entries(replies)) {
    command.prompt.trap(prompt).replyWith(reply)
  }

  await command.exec()

  return command
}

test.group('Accounts | first superadmin', (group) => {
  useTransaction(group)

  test('creates a superadmin from its flags', async ({ assert }) => {
    const command = await run([
      '--name=First Admin',
      '--email=first@wanderlore.test',
      '--password=a-long-password',
    ])

    command.assertSucceeded()
    const row = await db.from('users').where('email', 'first@wanderlore.test').firstOrFail()
    assert.equal(row.role, 'superadmin')
    assert.equal(row.full_name, 'First Admin')
    assert.isNull(row.suspended_at)
    assert.isTrue(await hash.verify(row.password, 'a-long-password'))
  })

  test('asks for what it is not given, the password twice', async ({ assert }) => {
    const command = await run([], {
      'Full name': 'Asked Admin',
      'Email': 'asked@wanderlore.test',
      'Password': 'a-long-password',
      'Password again': 'a-long-password',
    })

    command.assertSucceeded()
    assert.equal(await countRows('users', { email: 'asked@wanderlore.test' }), 1)
  })

  test('creates nothing when the two passwords differ', async ({ assert }) => {
    const command = await run(['--name=Admin', '--email=differ@wanderlore.test'], {
      'Password': 'a-long-password',
      'Password again': 'another-password',
    })

    command.assertFailed()
    assert.equal(await countRows('users', { email: 'differ@wanderlore.test' }), 0)
  })

  test('refuses an email already taken', async ({ assert }) => {
    await createUser({ email: 'taken@wanderlore.test' })

    const command = await run([
      '--name=Admin',
      '--email=taken@wanderlore.test',
      '--password=a-long-password',
    ])

    command.assertFailed()
    assert.equal(await countRows('users', { email: 'taken@wanderlore.test' }), 1)
  })

  test('refuses a password too short', async ({ assert }) => {
    const command = await run(['--name=Admin', '--email=short@wanderlore.test', '--password=short'])

    command.assertFailed()
    assert.equal(await countRows('users', { email: 'short@wanderlore.test' }), 0)
  })
})

test.group('Accounts | test superadmin', (group) => {
  useTransaction(group)

  test('seeds one superadmin, however often it runs', async ({ assert }) => {
    await new SuperadminSeeder(db.connection()).run()
    await new SuperadminSeeder(db.connection()).run()

    assert.equal(await countRows('users', { email: 'admin@wanderlore.test' }), 1)
    const row = await db.from('users').where('email', 'admin@wanderlore.test').firstOrFail()
    assert.equal(row.role, 'superadmin')
  })
})
