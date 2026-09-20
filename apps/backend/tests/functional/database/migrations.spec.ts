import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

const TABLES = ['users', 'auth_access_tokens', 'sessions', 'characters', 'world_states', 'turn_log']

const ENUM_TYPES = ['user_role', 'session_status']

async function existingTables(): Promise<string[]> {
  const { rows } = await db.rawQuery("select tablename from pg_tables where schemaname = 'public'")
  return rows.map((row: { tablename: string }) => row.tablename)
}

async function existingEnumTypes(): Promise<string[]> {
  const { rows } = await db.rawQuery('select typname from pg_type where typname = any(?)', [
    ENUM_TYPES,
  ])
  return rows.map((row: { typname: string }) => row.typname)
}

/**
 * Migrations must be reversible, and re-runnable on a database where the native
 * enum types outlived their tables.
 *
 * This is not a hypothetical: both failure modes hit during Phase 0.
 * `migration:fresh` drops tables but leaves types behind, so the next
 * `migration:run` died on `type "user_role" already exists`.
 *
 * This group runs DDL, so it deliberately opts out of the per-test transaction.
 * Migrations always go through `testUtils.db()`, which passes
 * `--no-schema-generate` and so leaves the committed `database/schema.ts` alone
 * — note that `migration:fresh` does not accept that flag, which is why the
 * scenario below is reproduced in SQL rather than by calling it.
 */
test.group('Migrations', (group) => {
  /**
   * Whatever happens mid-test, the next spec file must find a usable schema.
   */
  group.teardown(async () => {
    await testUtils.db().migrate()
  })

  test('a full rollback leaves no table and no orphan enum type behind', async ({ assert }) => {
    const rollback = await testUtils.db().migrate()

    await rollback()

    assert.notIncludeMembers(await existingTables(), TABLES)

    /**
     * The regression that bit twice: `dropTable` does not drop a native enum
     * type, so each migration has to drop its own in `down()`.
     */
    assert.isEmpty(await existingEnumTypes())

    await testUtils.db().migrate()

    assert.includeMembers(await existingTables(), TABLES)

    const restoredTypes = await existingEnumTypes()
    assert.deepEqual(restoredTypes.sort(), [...ENUM_TYPES].sort())
  })

  test('migrations re-run cleanly when enum types survived the tables', async ({ assert }) => {
    /**
     * Reproduces what `migration:fresh` leaves behind: tables gone, types still
     * there. The guarded `DO $$ … EXCEPTION WHEN duplicate_object` block in each
     * migration is what makes the re-run succeed.
     */
    for (const table of TABLES) {
      await db.rawQuery(`drop table if exists "${table}" cascade`)
    }
    await db.rawQuery('delete from adonis_schema')

    const survivingTypes = await existingEnumTypes()
    assert.deepEqual(survivingTypes.sort(), [...ENUM_TYPES].sort())

    await testUtils.db().migrate()

    assert.includeMembers(await existingTables(), TABLES)
  })
})
