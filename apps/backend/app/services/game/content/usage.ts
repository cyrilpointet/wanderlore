import db from '@adonisjs/lucid/services/db'

import { Refusal } from '#exceptions/refusal'

/** What a piece of content is, for the message a refused deletion carries. */
export type ContentKind =
  | 'world'
  | 'scenario'
  | 'attribute'
  | 'skill'
  | 'resource'
  | 'action_type'
  | 'chapter'
  | 'quest'
  | 'npc'
  | 'location'
  | 'item'

/**
 * Content that games are played with cannot be deleted: their state names it
 * by reference, and a reference left dangling would break them. Editing it
 * stays possible — it reaches those games from their next turn.
 */
export class ContentInUseError extends Refusal {
  constructor(kind: ContentKind, references: string[]) {
    super(
      409,
      'content_in_use',
      `Games are played with this ${kind.replace('_', ' ')}: it cannot be deleted.`,
      { kind, references }
    )
  }
}

/** The games a check looks into: all those of a world, or of one of its scenarios. */
export type GamesScope = { worldId: string } | { scenarioId: string }

function sessionsOf(scope: GamesScope) {
  return 'scenarioId' in scope
    ? db.from('sessions').where('scenario_id', scope.scenarioId).select('id')
    : db.from('sessions').where('world_id', scope.worldId).select('id')
}

/** Refuses when any game is played in this world, or from this scenario. */
export async function refuseIfPlayed(kind: 'world' | 'scenario', scope: GamesScope) {
  const played = await sessionsOf(scope).first()

  if (played) {
    throw new ContentInUseError(kind, [])
  }
}

/**
 * Refuses the removal of attributes, skills or resources that a character of
 * these games still has a score in.
 */
export async function refuseRemovedScores(
  kind: 'attribute' | 'skill' | 'resource',
  scope: GamesScope,
  removed: string[]
) {
  if (removed.length === 0) return

  const column = { attribute: 'attributes', skill: 'skills', resource: 'resources' }[kind]
  const rows: { reference: string }[] = await db
    .from('characters')
    .whereIn('session_id', sessionsOf(scope))
    .joinRaw(`cross join lateral jsonb_object_keys(characters.${column}) as reference`)
    .whereIn('reference', removed)
    .distinct('reference')

  refuseFound(kind, rows)
}

/** Refuses the removal of categories of action a logged roll of these games resolved. */
export async function refuseRemovedActionTypes(scope: GamesScope, removed: string[]) {
  if (removed.length === 0) return

  const rows: { reference: string }[] = await db
    .from('turn_log')
    .whereIn('session_id', sessionsOf(scope))
    .whereRaw(`roll_result->>'actionType' = any(?)`, [removed])
    .select(db.raw(`distinct roll_result->>'actionType' as reference`))

  refuseFound('action_type', rows)
}

/** Refuses the removal of chapters these games stand in. */
export async function refuseRemovedChapters(scope: GamesScope, removed: string[]) {
  if (removed.length === 0) return

  const rows: { reference: string }[] = await db
    .from('sessions')
    .whereIn('id', sessionsOf(scope))
    .whereIn('current_chapter', removed)
    .distinct('current_chapter as reference')

  refuseFound('chapter', rows)
}

/** Refuses the removal of quests these games carry. */
export async function refuseRemovedQuests(scope: GamesScope, removed: string[]) {
  if (removed.length === 0) return

  const rows: { reference: string }[] = await db
    .from('world_states')
    .whereIn('session_id', sessionsOf(scope))
    .joinRaw('cross join lateral jsonb_array_elements(world_states.active_quests) as quest')
    .whereRaw(`quest->>'reference' = any(?)`, [removed])
    .select(db.raw(`distinct quest->>'reference' as reference`))

  refuseFound('quest', rows)
}

/**
 * Refuses the deletion of a definition an instance of these games was made
 * from — a person met, a place visited or the parent of one, an item.
 */
export async function refuseUsedDefinition(
  kind: 'npc' | 'location' | 'item',
  scope: GamesScope,
  reference: string
) {
  const sessions = sessionsOf(scope)
  const query =
    kind === 'npc'
      ? db.from('npc_instances').where('definition_reference', reference)
      : kind === 'location'
        ? db
            .from('location_instances')
            .where((place) =>
              place.where('definition_reference', reference).orWhere('parent_reference', reference)
            )
        : db.from('inventory_items').where('definition_reference', reference)

  const used = await query.whereIn('session_id', sessions).first()

  if (used) {
    throw new ContentInUseError(kind, [reference])
  }
}

function refuseFound(kind: ContentKind, rows: { reference: string }[]) {
  if (rows.length > 0) {
    throw new ContentInUseError(
      kind,
      rows.map(({ reference }) => reference)
    )
  }
}

/** The references of a list the new version no longer has. */
export function removedReferences(
  before: { reference: string }[],
  after: { reference: string }[] | undefined
): string[] {
  if (after === undefined) return []

  const kept = new Set(after.map(({ reference }) => reference))

  return before.map(({ reference }) => reference).filter((reference) => !kept.has(reference))
}
