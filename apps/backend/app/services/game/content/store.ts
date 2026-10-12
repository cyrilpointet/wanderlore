import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'

import World from '#models/world'
import Scenario from '#models/scenario'
import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import ResolutionRule from '#models/resolution_rule'
import LocationDefinition from '#models/location_definition'

import type {
  Catalogues,
  ItemDefinitionContent,
  LocationDefinitionContent,
  NpcDefinitionContent,
  ScenarioContent,
  WorldContent,
} from './types.js'

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
      rules: content.rules,
      ambiance: content.ambiance,
      attributes: content.attributes,
      skills: content.skills,
      resources: content.resources,
      glossary: content.glossary,
    },
    { client: trx }
  )

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

  for (const { npcs, locations, items, ...scenario } of content.scenarios) {
    const row = await Scenario.updateOrCreate(
      { worldId: world.id, reference: scenario.reference },
      {
        labels: scenario.labels,
        synopsis: scenario.synopsis,
        status: scenario.status,
        chapters: scenario.chapters,
        quests: scenario.quests,
        pregeneratedCharacter: scenario.pregeneratedCharacter,
        initialState: scenario.initialState,
        glossary: scenario.glossary,
      },
      { client: trx }
    )

    await storeCatalogues(world.id, row.id, { npcs, locations, items }, trx)
    scenarios.set(scenario.reference, row)
  }

  return { world, scenarios }
}

/** The three catalogues of one level: the world's (`scenarioId` null) or a scenario's. */
async function storeCatalogues(
  worldId: string,
  scenarioId: string | null,
  catalogues: Catalogues,
  trx: TransactionClientContract
): Promise<void> {
  await storeDefinitions(NpcDefinition, worldId, scenarioId, catalogues.npcs, trx)
  await storeDefinitions(LocationDefinition, worldId, scenarioId, catalogues.locations, trx)
  await storeDefinitions(ItemDefinition, worldId, scenarioId, catalogues.items, trx)
}

type DefinitionModel = typeof NpcDefinition | typeof LocationDefinition | typeof ItemDefinition

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
  const world = await World.findOrFail(worldId, { client })
  const rules = await ResolutionRule.query({ client })
    .where('worldId', worldId)
    .orderBy('actionType')
  const scenarios = await Scenario.query({ client }).where('worldId', worldId).orderBy('reference')

  return {
    reference: world.reference,
    labels: world.labels,
    narrativeTone: world.narrativeTone,
    rules: world.rules,
    ambiance: world.ambiance,
    attributes: world.attributes,
    skills: world.skills,
    resources: world.resources,
    glossary: world.glossary,
    actionTypes: rules.map(({ actionType, description, associatedSkill }) => ({
      actionType,
      description,
      associatedSkill,
    })),
    ...(await readCatalogues(worldId, null, client)),
    scenarios: await Promise.all(scenarios.map((scenario) => scenarioContentOf(scenario, client))),
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
    pregeneratedCharacter: scenario.pregeneratedCharacter,
    initialState: scenario.initialState,
    glossary: scenario.glossary,
    ...(await readCatalogues(scenario.worldId, scenario.id, client)),
  }
}

/** One level of the three catalogues: the world's (`scenarioId` null) or a scenario's. */
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

  const [npcs, locations, items] = await Promise.all([
    level(NpcDefinition.query({ client })),
    level(LocationDefinition.query({ client })),
    level(ItemDefinition.query({ client })),
  ])

  return {
    npcs: npcs.map((npc): NpcDefinitionContent => ({
      reference: npc.reference,
      labels: npc.labels,
      description: npc.description,
      kind: npc.kind,
      generic: npc.generic,
      defaultDisposition: npc.defaultDisposition,
      combat: npc.combat,
    })),
    locations: locations.map((location): LocationDefinitionContent => ({
      reference: location.reference,
      labels: location.labels,
      description: location.description,
      kind: location.kind,
      parent: location.parent,
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
      initialHolder: item.initialHolder,
    })),
  }
}
