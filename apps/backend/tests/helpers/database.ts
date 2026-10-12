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
export const PG_CHECK_VIOLATION = '23514'

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

export async function createWorld(reference = unique('world').replace(/-/g, '_')): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('worlds')
    .insert({
      reference,
      labels: { en: 'Test World' },
      narrative_tone: 'A world written by a test.',
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createScenario(
  worldId: string,
  overrides: Partial<{ reference: string; status: string }> = {}
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('scenarios')
    .insert({
      world_id: worldId,
      reference: overrides.reference ?? unique('scenario').replace(/-/g, '_'),
      labels: { en: 'Test Scenario' },
      ...(overrides.status ? { status: overrides.status } : {}),
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

/**
 * A game needs a world and one of its scenarios: given, or a fresh pair made
 * for it.
 */
export async function createSession(
  userId: string,
  overrides: Partial<{
    status: string
    currentChapter: string
    worldId: string
    scenarioId: string
  }> = {}
): Promise<string> {
  const worldId = overrides.worldId ?? (await createWorld())
  const scenarioId = overrides.scenarioId ?? (await createScenario(worldId))

  const now = new Date()
  const [row] = await db
    .table('sessions')
    .insert({
      user_id: userId,
      world_id: worldId,
      scenario_id: scenarioId,
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

export async function createWorldState(
  sessionId: string,
  currentLocationId: string | null = null
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('world_states')
    .insert({
      session_id: sessionId,
      current_location_id: currentLocationId,
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createLocationInstance(
  sessionId: string,
  handle = 'paris',
  overrides: Partial<{ definitionReference: string; parentReference: string | null }> = {}
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('location_instances')
    .insert({
      session_id: sessionId,
      handle,
      definition_reference: overrides.definitionReference ?? handle,
      parent_reference: overrides.parentReference ?? null,
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createNpcInstance(
  sessionId: string,
  handle = 'treville',
  overrides: Partial<{ definitionReference: string; disposition: string; status: string }> = {}
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('npc_instances')
    .insert({
      session_id: sessionId,
      handle,
      definition_reference: overrides.definitionReference ?? handle,
      disposition: overrides.disposition ?? 'neutral',
      ...(overrides.status ? { status: overrides.status } : {}),
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createInventoryItem(
  sessionId: string,
  holder: { characterId?: string; npcInstanceId?: string; locationInstanceId?: string },
  overrides: Partial<{
    handle: string | null
    definitionReference: string
    quantity: number
    state: string
  }> = {}
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('inventory_items')
    .insert({
      session_id: sessionId,
      character_id: holder.characterId ?? null,
      npc_instance_id: holder.npcInstanceId ?? null,
      location_instance_id: holder.locationInstanceId ?? null,
      handle: overrides.handle === undefined ? 'rapier_1' : overrides.handle,
      definition_reference: overrides.definitionReference ?? 'rapier',
      ...(overrides.quantity === undefined ? {} : { quantity: overrides.quantity }),
      ...(overrides.state ? { state: overrides.state } : {}),
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function createTurn(
  sessionId: string,
  turnNumber: number | null = 1,
  overrides: Partial<{ status: string; failure: Record<string, unknown> | null }> = {}
): Promise<string> {
  const [row] = await db
    .table('turn_log')
    .insert({
      session_id: sessionId,
      turn_number: turnNumber,
      status: overrides.status ?? 'completed',
      failure: overrides.failure ?? null,
      player_input: 'I look around.',
      created_at: new Date(),
    })
    .returning('id')

  return row.id
}

export async function createResolutionRule(
  worldId: string,
  actionType: string,
  associatedSkill = 'athletics'
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .table('resolution_rules')
    .insert({
      world_id: worldId,
      action_type: actionType,
      description: 'A rule written by a test.',
      associated_skill: associatedSkill,
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id
}

export async function countRows(table: string, where: Record<string, unknown>): Promise<number> {
  const result = await db.from(table).where(where).count('* as total').first()
  return Number(result.total)
}
