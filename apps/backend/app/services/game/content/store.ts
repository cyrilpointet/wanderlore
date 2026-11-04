import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'

import World from '#models/world'
import Scenario from '#models/scenario'
import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import LoreFragment from '#models/lore_fragment'
import ResolutionRule from '#models/resolution_rule'
import Profession from '#models/profession'
import LocationDefinition from '#models/location_definition'

import type {
  ActionTypeContent,
  Catalogues,
  ItemDefinitionContent,
  LocationDefinitionContent,
  LoreFragmentContent,
  NpcDefinitionContent,
  ProfessionContent,
  ScenarioContent,
  WorldContent,
} from './types.js'
import type { WorldLevelContent } from './resolve.js'

export type StoredWorld = {
  world: World
  /** Scenario rows by reference. */
  scenarios: Map<string, Scenario>
}

/**
 * Writes a world and everything it declares, matched on references: a rerun
 * updates rows in place and duplicates nothing, so the content written in code
 * can be seeded into every environment as often as needed.
 *
 * The content is the source of truth for what it covers: a category of action
 * or a definition it no longer declares is deleted, or the model would keep
 * being offered it. A scenario it no longer declares is left alone — games
 * may have been played from it.
 */
export async function storeWorldContent(
  content: WorldContent,
  trx: TransactionClientContract
): Promise<StoredWorld> {
  const world = await World.updateOrCreate(
    { reference: content.reference },
    {
      labels: content.labels,
      narrativeTone: content.narrativeTone,
      powerLevel: content.powerLevel,
      skills: content.skills,
      resources: content.resources,
      glossary: content.glossary,
    },
    { client: trx }
  )

  await storeProfessions(world.id, content.professions, trx)

  await ResolutionRule.updateOrCreateMany(
    ['worldId', 'actionType'],
    content.actionTypes.map((rule) => ({ worldId: world.id, ...rule })),
    { client: trx }
  )
  await ResolutionRule.query({ client: trx })
    .where('worldId', world.id)
    .whereNotIn(
      'actionType',
      content.actionTypes.map((rule) => rule.actionType)
    )
    .delete()

  await storeCatalogues(world.id, null, content, trx)

  const scenarios = new Map<string, Scenario>()

  for (const { npcs, locations, items, lore, ...scenario } of content.scenarios) {
    const row = await Scenario.updateOrCreate(
      { worldId: world.id, reference: scenario.reference },
      {
        labels: scenario.labels,
        synopsis: scenario.synopsis,
        status: scenario.status,
        chapters: scenario.chapters,
        quests: scenario.quests,
        startingKit: scenario.startingKit,
        initialState: scenario.initialState,
        startTime: scenario.startTime,
        startDate: scenario.startDate,
        glossary: scenario.glossary,
        flags: scenario.flags,
        events: scenario.events,
      },
      { client: trx }
    )

    await storeCatalogues(world.id, row.id, { npcs, locations, items, lore }, trx)
    scenarios.set(scenario.reference, row)
  }

  return { world, scenarios }
}

/**
 * The professions of a world, matched on references. One the content no
 * longer declares is deleted, unless a character follows it: a character
 * keeps their profession for good.
 */
export async function storeProfessions(
  worldId: string,
  professions: ProfessionContent[],
  trx: TransactionClientContract
): Promise<void> {
  await Profession.updateOrCreateMany(
    ['worldId', 'reference'],
    professions.map((profession) => ({ worldId, ...profession })),
    { client: trx }
  )
  await Profession.query({ client: trx })
    .where('worldId', worldId)
    .whereNotIn(
      'reference',
      professions.map(({ reference }) => reference)
    )
    .whereNotExists((characters) =>
      characters.from('characters').whereColumn('characters.profession_id', 'professions.id')
    )
    .delete()
}

/** The catalogues of one level: the world's (`scenarioId` null) or a scenario's. */
export async function storeCatalogues(
  worldId: string,
  scenarioId: string | null,
  catalogues: Catalogues,
  trx: TransactionClientContract
): Promise<void> {
  await storeDefinitions(NpcDefinition, worldId, scenarioId, catalogues.npcs, trx)
  await storeDefinitions(LocationDefinition, worldId, scenarioId, catalogues.locations, trx)
  await storeDefinitions(ItemDefinition, worldId, scenarioId, catalogues.items, trx)
  await storeDefinitions(LoreFragment, worldId, scenarioId, catalogues.lore, trx)
}

type DefinitionModel =
  typeof NpcDefinition | typeof LocationDefinition | typeof ItemDefinition | typeof LoreFragment

/**
 * One level of one catalogue. Written row by row rather than through
 * `updateOrCreateMany`, which cannot match on a null `scenario_id`.
 */
async function storeDefinitions(
  Model: DefinitionModel,
  worldId: string,
  scenarioId: string | null,
  definitions: { reference: string }[],
  trx: TransactionClientContract
): Promise<void> {
  const level = () => {
    const query = (Model as typeof NpcDefinition).query({ client: trx }).where('worldId', worldId)

    return scenarioId === null
      ? query.whereNull('scenarioId')
      : query.where('scenarioId', scenarioId)
  }

  const rows = await level()
  const existing = new Map(rows.map((row) => [row.reference, row]))

  for (const definition of definitions) {
    const row = existing.get(definition.reference)

    if (row) {
      await row.merge(definition as never).save()
    } else {
      await (Model as typeof NpcDefinition).create(
        { ...definition, worldId, scenarioId } as never,
        {
          client: trx,
        }
      )
    }
  }

  await level()
    .whereNotIn(
      'reference',
      definitions.map((definition) => definition.reference)
    )
    .delete()
}

/**
 * A world and everything it declares, read back in the shape it was written
 * in. Definitions and categories come sorted by reference, so two reads of
 * the same content are equal whatever order the rows were written in.
 */
export async function readWorldContent(
  worldId: string,
  client?: QueryClientContract
): Promise<WorldContent> {
  const scenarios = await Scenario.query({ client }).where('worldId', worldId).orderBy('reference')

  return {
    ...(await readWorldLevel(worldId, client)),
    scenarios: await sequentially(scenarios, (scenario) => scenarioContentOf(scenario, client)),
  }
}

/** What a world brings to every game played in it, its scenarios aside. */
export async function readWorldLevel(
  worldId: string,
  client?: QueryClientContract
): Promise<WorldLevelContent> {
  const world = await World.findOrFail(worldId, { client })
  const rules = await ResolutionRule.query({ client })
    .where('worldId', worldId)
    .orderBy('actionType')
  const professions = await Profession.query({ client })
    .where('worldId', worldId)
    .orderBy('reference')

  return {
    reference: world.reference,
    labels: world.labels,
    narrativeTone: world.narrativeTone,
    powerLevel: world.powerLevel,
    skills: world.skills,
    resources: world.resources,
    glossary: world.glossary,
    actionTypes: rules.map(actionTypeOf),
    professions: professions.map(professionContentOf),
    ...(await readCatalogues(worldId, null, client)),
  }
}

export function professionContentOf(profession: Profession): ProfessionContent {
  return {
    reference: profession.reference,
    labels: profession.labels,
    description: profession.description,
    skills: profession.skills,
    startingItems: profession.startingItems,
    startingResources: profession.startingResources,
  }
}

export async function scenarioContentOf(
  scenario: Scenario,
  client?: QueryClientContract
): Promise<ScenarioContent> {
  return {
    reference: scenario.reference,
    labels: scenario.labels,
    synopsis: scenario.synopsis,
    status: scenario.status,
    chapters: scenario.chapters,
    quests: scenario.quests,
    startingKit: scenario.startingKit,
    initialState: scenario.initialState,
    startTime: scenario.startTime,
    startDate: scenario.startDate,
    glossary: scenario.glossary,
    flags: scenario.flags,
    events: scenario.events,
    ...(await readCatalogues(scenario.worldId, scenario.id, client)),
  }
}

/** One level of the catalogues: the world's (`scenarioId` null) or a scenario's. */
export async function readCatalogues(
  worldId: string,
  scenarioId: string | null,
  client?: QueryClientContract
): Promise<Catalogues> {
  const level = <Query extends { where: Function; whereNull: Function; orderBy: Function }>(
    query: Query
  ): Query => {
    query.where('worldId', worldId).orderBy('reference')

    return scenarioId === null
      ? query.whereNull('scenarioId')
      : query.where('scenarioId', scenarioId)
  }

  /**
   * One after the other: inside a transaction they share one connection,
   * which runs a single query at a time anyway.
   */
  const npcs = await level(NpcDefinition.query({ client }))
  const locations = await level(LocationDefinition.query({ client }))
  const items = await level(ItemDefinition.query({ client }))
  const lore = await level(LoreFragment.query({ client }))

  return {
    npcs: npcs.map((npc): NpcDefinitionContent => ({
      reference: npc.reference,
      labels: npc.labels,
      description: npc.description,
      kind: npc.kind,
      generic: npc.generic,
      defaultDisposition: npc.defaultDisposition,
      combat: npc.combat,
      initialLocation: npc.initialLocation,
      schedule: npc.schedule,
    })),
    locations: locations.map((location): LocationDefinitionContent => ({
      reference: location.reference,
      labels: location.labels,
      description: location.description,
      kind: location.kind,
      parent: location.parent,
      exits: location.exits,
      entrance: location.entrance,
      periodNotes: location.periodNotes,
    })),
    items: items.map((item): ItemDefinitionContent => ({
      reference: item.reference,
      labels: item.labels,
      description: item.description,
      kind: item.kind,
      generic: item.generic,
      stackable: item.stackable,
      equippable: item.equippable,
      modifiers: item.modifiers,
      weapon: item.weapon,
      armor: item.armor,
      initialHolder: item.initialHolder,
    })),
    lore: lore.map(loreFragmentOf),
  }
}

export function loreFragmentOf(fragment: LoreFragment): LoreFragmentContent {
  return {
    reference: fragment.reference,
    kind: fragment.kind,
    content: fragment.content,
    tags: fragment.tags,
    secret: fragment.secret,
  }
}

/**
 * A category of action as stored: the check constraint of the table keeps
 * exactly one of skill and characteristic.
 */
export function actionTypeOf(rule: ResolutionRule): ActionTypeContent {
  const { actionType, description, associatedSkill, associatedCharacteristic } = rule

  if (associatedSkill !== null) {
    return { actionType, description, associatedSkill, associatedCharacteristic: null }
  }

  if (associatedCharacteristic !== null) {
    return { actionType, description, associatedSkill: null, associatedCharacteristic }
  }

  throw new Error(`Action type ${actionType} is resolved by neither a skill nor a characteristic.`)
}

async function sequentially<Item, Result>(
  items: Item[],
  run: (item: Item) => Promise<Result>
): Promise<Result[]> {
  const results: Result[] = []

  for (const item of items) {
    results.push(await run(item))
  }

  return results
}
