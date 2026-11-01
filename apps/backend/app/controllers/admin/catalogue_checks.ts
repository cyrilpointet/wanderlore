import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import LocationDefinition from '#models/location_definition'
import { Refusal } from '#exceptions/refusal'

/**
 * What the validators cannot see in a definition or a fragment on its own:
 * a field one kind may not have, a tag naming nothing. Refused on the field
 * at fault rather than left to the database constraints — for one entry
 * written in its form, as for every entry of an imported file.
 */

/** The level an entry is written at: a world's, or one of its scenarios'. Null for a world not created yet. */
export type CatalogueLevel = { worldId: string | null; scenarioId: string | null }

/**
 * What only one kind of definition may have: a unique is neither generic nor
 * stackable, an archetype has no parent, initial holder or place, exit nor
 * entrance.
 */
export function refuseKindMismatch(definition: Record<string, unknown>, path = '') {
  const unique = definition.kind === 'unique'
  const mismatch = unique
    ? (['generic', 'stackable'] as const).find((field) => definition[field] === true)
    : (['parent', 'initialHolder', 'initialLocation', 'exits', 'entrance'] as const).find(
        (field) => {
          const value = definition[field]

          return Array.isArray(value)
            ? value.length > 0
            : value !== null && value !== undefined && value !== false
        }
      )

  if (mismatch) {
    throw new Refusal(
      422,
      'kind_mismatch',
      unique
        ? `A unique definition cannot be ${mismatch}.`
        : `An archetype has no ${ARCHETYPE_LACKS[mismatch as keyof typeof ARCHETYPE_LACKS]}.`,
      { field: `${path}${mismatch}` }
    )
  }
}

const ARCHETYPE_LACKS = {
  parent: 'parent',
  initialHolder: 'initial holder',
  initialLocation: 'initial place',
  exits: 'exit',
  entrance: 'entrance',
}

export type LorePayload = { kind: string; tags?: string[]; secret?: boolean }

/** Ambiance goes to the narrator only: a secret one would reach no step. */
export function refuseSecretAmbiance(fragment: LorePayload, path = '') {
  if (fragment.secret === true && fragment.kind === 'ambiance') {
    throw new Refusal(
      422,
      'secret_ambiance',
      'An ambiance goes to the narrator only: it cannot be secret.',
      { field: `${path}secret` }
    )
  }
}

/**
 * A tag is the reference of a place, a person or an item: of the world for a
 * world fragment, of the world or of the scenario for a scenario's — or of
 * the file the fragment is imported with. Any other word would never match a
 * scene, and the fragment never be sent.
 */
export async function refuseUnknownTags(
  fragment: LorePayload,
  level: CatalogueLevel,
  imported: Set<string> = new Set(),
  path = ''
) {
  const tags = (fragment.tags ?? []).filter((tag) => !imported.has(tag))

  if (tags.length === 0) {
    return
  }

  const known = new Set<string>()
  if (level.worldId !== null) {
    for (const Model of [NpcDefinition, LocationDefinition, ItemDefinition] as const) {
      const rows = await (Model as typeof NpcDefinition)
        .query()
        .where('worldId', level.worldId)
        .whereIn('reference', tags)
        .where((query) => {
          query.whereNull('scenarioId')
          if (level.scenarioId !== null) query.orWhere('scenarioId', level.scenarioId)
        })
        .select('reference')

      rows.forEach(({ reference }) => known.add(reference))
    }
  }

  const unknown = tags.filter((tag) => !known.has(tag))

  if (unknown.length > 0) {
    throw new Refusal(
      422,
      'unknown_tag',
      `"${unknown[0]}" is no place, person or item of this world.`,
      { field: `${path}tags`, references: unknown }
    )
  }
}
