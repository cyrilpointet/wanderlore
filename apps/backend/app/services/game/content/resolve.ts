import type {
  ItemDefinition,
  LocationDefinition,
  NpcDefinition,
  WorldDefinition,
} from '#services/game/world'

import type {
  ItemDefinitionContent,
  LabelledEntry,
  LocationDefinitionContent,
  NpcDefinitionContent,
  ScenarioContent,
  WorldContent,
} from './types.js'

/** What a world brings to a game, its scenarios aside. */
export type WorldLevelContent = Omit<WorldContent, 'scenarios'>

/**
 * The world one game is played in: the world's content, then its scenario's,
 * a scenario definition replacing the world definition of the same
 * reference. Pure, so the turn and the content checks build it the same way
 * from whatever source they read.
 */
export function resolveWorld(world: WorldLevelContent, scenario: ScenarioContent): WorldDefinition {
  return {
    reference: world.reference,
    label: world.labels.en,
    labels: world.labels,
    tone: world.narrativeTone,
    rules: world.rules,
    ambiance: world.ambiance,
    skills: world.skills.map((skill) => ({
      ...entryOf(skill),
      category: skill.category,
      baseChance: skill.baseChance,
    })),
    resources: world.resources.map(entryOf),
    actionTypes: world.actionTypes,
    npcs: overlay(world.npcs, scenario.npcs).map(npcOf),
    locations: overlay(world.locations, scenario.locations).map(locationOf),
    items: overlay(world.items, scenario.items).map(itemOf),
    chapters: scenario.chapters.map(entryOf),
    quests: scenario.quests.map(entryOf),
    glossary: overlay(world.glossary, scenario.glossary).map(entryOf),
  }
}

/**
 * The world's definitions in their order, each replaced in place by the
 * scenario's of the same reference, then the scenario's own.
 */
export function overlay<Definition extends { reference: string }>(
  worldLevel: Definition[],
  scenarioLevel: Definition[]
): Definition[] {
  const overrides = new Map(scenarioLevel.map((definition) => [definition.reference, definition]))
  const inherited = worldLevel.map(
    (definition) => overrides.get(definition.reference) ?? definition
  )
  const known = new Set(worldLevel.map((definition) => definition.reference))

  return [...inherited, ...scenarioLevel.filter((definition) => !known.has(definition.reference))]
}

function entryOf(entry: LabelledEntry) {
  return { reference: entry.reference, label: entry.labels.en, labels: entry.labels }
}

function npcOf(npc: NpcDefinitionContent): NpcDefinition {
  const shared = {
    ...entryOf(npc),
    description: npc.description,
    defaultDisposition: npc.defaultDisposition,
    combat: npc.combat,
  }

  return npc.kind === 'unique'
    ? { ...shared, kind: 'unique' }
    : { ...shared, kind: 'archetype', generic: npc.generic }
}

function locationOf(location: LocationDefinitionContent): LocationDefinition {
  const shared = { ...entryOf(location), description: location.description }

  return location.kind === 'unique'
    ? {
        ...shared,
        kind: 'unique',
        parent: location.parent,
        exits: location.exits,
        entrance: location.entrance,
      }
    : { ...shared, kind: 'archetype' }
}

function itemOf(item: ItemDefinitionContent): ItemDefinition {
  const shared = {
    ...entryOf(item),
    description: item.description,
    equippable: item.equippable,
    modifiers: item.modifiers,
    weapon: item.weapon,
  }

  return item.kind === 'unique'
    ? { ...shared, kind: 'unique', initialHolder: item.initialHolder }
    : { ...shared, kind: 'archetype', generic: item.generic, stackable: item.stackable }
}
