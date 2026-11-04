import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import LocationDefinition from '#models/location_definition'
import { Refusal } from '#exceptions/refusal'
import type { Catalogues } from '#services/game/content/types'

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
 * stackable, an archetype has no parent, initial holder or place, schedule,
 * exit nor entrance.
 */
export function refuseKindMismatch(definition: Record<string, unknown>, path = '') {
  const unique = definition.kind === 'unique'
  const mismatch = unique
    ? (['generic', 'stackable'] as const).find((field) => definition[field] === true)
    : (
        ['parent', 'initialHolder', 'initialLocation', 'schedule', 'exits', 'entrance'] as const
      ).find((field) => {
        const value = definition[field]

        return Array.isArray(value)
          ? value.length > 0
          : value !== null && value !== undefined && value !== false
      })

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
  schedule: 'schedule',
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

/**
 * A skill or a characteristic, exactly one: the table refuses anything else,
 * but with a message the back-office cannot show. `path` names the entry of
 * an imported file at fault.
 */
export function refuseUnlessOneResolution(
  resolution: { associatedSkill: string | null; associatedCharacteristic: string | null },
  path?: string
) {
  const set = [resolution.associatedSkill, resolution.associatedCharacteristic].filter(
    (value) => value !== null
  )

  if (set.length !== 1) {
    throw new Refusal(
      422,
      'one_resolution',
      'A category of action is resolved by a skill or by a characteristic, exactly one of them.',
      path === undefined ? undefined : { field: path }
    )
  }
}

/**
 * The catalogues of an imported world or scenario, entry by entry, before
 * anything is written: the first fault refuses the whole file, on the path of
 * the faulty field (`lore.3.tags`). A tag may name a definition of the file
 * itself.
 */
export async function refuseImportedCatalogues(catalogues: Catalogues, level: CatalogueLevel) {
  const lists = [
    ['npcs', catalogues.npcs],
    ['locations', catalogues.locations],
    ['items', catalogues.items],
  ] as const

  for (const [list, definitions] of lists) {
    definitions.forEach((definition, index) =>
      refuseKindMismatch(definition as unknown as Record<string, unknown>, `${list}.${index}.`)
    )
  }

  const imported = new Set(
    [...catalogues.npcs, ...catalogues.locations, ...catalogues.items].map(
      ({ reference }) => reference
    )
  )

  for (const [index, fragment] of catalogues.lore.entries()) {
    refuseSecretAmbiance(fragment, `lore.${index}.`)
    await refuseUnknownTags(fragment, level, imported, `lore.${index}.`)
  }
}

/** Imported catalogues, with what a file may leave out filled in as a form would. */
export function importedCatalogues(payload: {
  npcs?: (Omit<Catalogues['npcs'][number], 'schedule'> & {
    schedule?: Catalogues['npcs'][number]['schedule']
  })[]
  locations?: (Omit<Catalogues['locations'][number], 'exits' | 'entrance' | 'periodNotes'> & {
    exits?: Catalogues['locations'][number]['exits']
    entrance?: boolean
    periodNotes?: Catalogues['locations'][number]['periodNotes']
  })[]
  items?: Catalogues['items']
  lore?: (Omit<Catalogues['lore'][number], 'tags' | 'secret'> & {
    tags?: string[]
    secret?: boolean
  })[]
}): Catalogues {
  return {
    npcs: (payload.npcs ?? []).map((npc) => ({ ...npc, schedule: npc.schedule ?? [] })),
    locations: (payload.locations ?? []).map((location) => ({
      ...location,
      exits: location.exits ?? [],
      entrance: location.entrance ?? false,
      periodNotes: location.periodNotes ?? [],
    })),
    items: payload.items ?? [],
    lore: (payload.lore ?? []).map((fragment) => ({
      ...fragment,
      tags: fragment.tags ?? [],
      secret: fragment.secret ?? false,
    })),
  }
}

/** What a profession may name: the world's skills, resources and items. */
export type ProfessionScope = {
  skills: Set<string>
  resources: Set<string>
  /** World items, by reference. */
  items: Set<string>
  /** Items of a scenario of the world only: a profession holds for every scenario, so never one of them. */
  scenarioItems: Set<string>
}

export type ProfessionPayload = {
  skills?: string[]
  startingItems?: { definition: string }[]
  startingResources?: Record<string, number>
}

/**
 * A profession names skills, resources and items of its world — and an item
 * of the world, never of a single scenario: the profession holds for all of
 * them. Refused on the field at fault; `path` names the entry of an imported
 * file.
 */
export function refuseProfession(profession: ProfessionPayload, scope: ProfessionScope, path = '') {
  for (const skill of profession.skills ?? []) {
    if (!scope.skills.has(skill)) {
      throw new Refusal(422, 'unknown_skill', `"${skill}" is no skill of this world.`, {
        field: `${path}skills`,
        references: [skill],
      })
    }
  }

  for (const [index, item] of (profession.startingItems ?? []).entries()) {
    const field = `${path}startingItems.${index}.definition`

    if (scope.items.has(item.definition)) continue

    throw scope.scenarioItems.has(item.definition)
      ? new Refusal(
          422,
          'scenario_item_in_profession',
          `"${item.definition}" belongs to a scenario: a profession gives items of its world only.`,
          { field, references: [item.definition] }
        )
      : new Refusal(422, 'unknown_item', `"${item.definition}" is no item of this world.`, {
          field,
          references: [item.definition],
        })
  }

  for (const resource of Object.keys(profession.startingResources ?? {})) {
    if (!scope.resources.has(resource)) {
      throw new Refusal(422, 'unknown_resource', `"${resource}" is no resource of this world.`, {
        field: `${path}startingResources`,
        references: [resource],
      })
    }
  }
}

/** What the professions of a stored world may name, read from the database. */
export async function professionScopeOf(world: {
  id: string
  skills: { reference: string }[]
  resources: { reference: string }[]
}): Promise<ProfessionScope> {
  const items = await ItemDefinition.query()
    .where('worldId', world.id)
    .select('reference', 'scenarioId')

  return {
    skills: new Set(world.skills.map(({ reference }) => reference)),
    resources: new Set(world.resources.map(({ reference }) => reference)),
    items: new Set(
      items.filter((item) => item.scenarioId === null).map(({ reference }) => reference)
    ),
    scenarioItems: new Set(
      items.filter((item) => item.scenarioId !== null).map(({ reference }) => reference)
    ),
  }
}
