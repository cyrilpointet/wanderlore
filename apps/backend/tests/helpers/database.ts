import db from '@adonisjs/lucid/services/db'
import type { Group } from '@japa/runner/core'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Wraps every test of a group in a transaction that is rolled back afterwards,
 * so tests never see each other's rows.
 *
 * Opt-in per group rather than global: a spec that runs DDL (migrations) must
 * stay outside any transaction.
 */
export function useTransaction(group: Group): void {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
}

/**
 * Driver-level detail of a rejected statement. Tests assert on `code`
 * (the SQLSTATE) rather than on the message, which is wording that PostgreSQL
 * is free to change.
 */
export type DatabaseError = {
  code: string
  constraint?: string
  message: string
}

/**
 * Common SQLSTATE codes asserted by the constraint specs.
 */
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_INVALID_TEXT_REPRESENTATION = '22P02'

/**
 * Runs a statement expected to be rejected, and returns the driver error.
 *
 * The statement is nested in its own transaction so the failure only unwinds to
 * a savepoint. Without it, the violation would poison the surrounding
 * transaction opened by `useTransaction`, and every later query in the same
 * test would fail with "current transaction is aborted".
 */
export async function expectDbError(run: () => Promise<unknown>): Promise<DatabaseError> {
  try {
    await db.transaction(run)
  } catch (error) {
    return error as DatabaseError
  }

  throw new Error('Expected the statement to be rejected by the database, but it succeeded.')
}

/**
 * Row factories.
 *
 * They still go through the query builder now that the models exist, and on
 * purpose: the specs they serve assert what the database enforces — SQLSTATE
 * codes, composite uniqueness, `ON DELETE` cascades. Arranging those rows
 * through Lucid would put the mapping under test between the spec and the
 * constraint it is checking.
 *
 * For the same reason they are the right fixture for `models.spec.ts`, which
 * proves the mapping itself and must not build its input with it.
 */

let sequence = 0
function unique(prefix: string): string {
  sequence += 1
  return `${prefix}-${Date.now()}-${sequence}`
}

export async function createUser(
  overrides: Partial<{ email: string; fullName: string; password: string; role: string }> = {}
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('users')
    .insert({
      full_name: overrides.fullName ?? 'Test User',
      email: overrides.email ?? `${unique('user')}@wanderlore.test`,
      password: overrides.password ?? 'hashed-password-placeholder',
      ...(overrides.role ? { role: overrides.role } : {}),
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createSession(
  userId: string,
  overrides: Partial<{ status: string; currentChapter: string }> = {}
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('sessions')
    .insert({
      user_id: userId,
      ...(overrides.status ? { status: overrides.status } : {}),
      current_chapter: overrides.currentChapter ?? null,
      created_at: now,
      last_activity_at: now,
    })
    .returning('id')

  return row.id
}

export async function createCharacter(sessionId: string, name = 'Test Character'): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('characters')
    .insert({
      session_id: sessionId,
      name,
      hit_points: 10,
      hit_points_max: 10,
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createWorldState(sessionId: string): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('world_states')
    .insert({
      session_id: sessionId,
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createTurn(sessionId: string, turnNumber = 1): Promise<string> {
  const [row] = await db
    .table('turn_log')
    .insert({
      session_id: sessionId,
      turn_number: turnNumber,
      player_input: 'I look around.',
      created_at: new Date(),
    })
    .returning('id')

  return row.id
}

export async function countRows(table: string, where: Record<string, unknown>): Promise<number> {
  const result = await db.from(table).where(where).count('* as total').first()
  return Number(result.total)
}
