import { overlay, type WorldLevelContent } from './resolve.js'
import type { LabelledEntry, ScenarioContent } from './types.js'

/**
 * Whether a world and one of its scenarios hold together well enough to be
 * played: every reference names something that exists, the model has the
 * generic archetypes it improvises from, and a game has a character to play
 * and a place to start in.
 *
 * Checked when a scenario is published, and again when a game is started
 * from it: content edited after publication cannot slip a broken scenario
 * past the players. Pure, so the checks run without a database.
 */

export type CoherenceIssueCode =
  | 'missing_english_label'
  | 'unknown_attribute'
  | 'unknown_skill'
  | 'unknown_resource'
  | 'unknown_location'
  | 'unknown_item'
  | 'unknown_holder'
  | 'unknown_chapter'
  | 'unknown_quest'
  | 'no_action_type'
  | 'missing_generic_npc'
  | 'missing_location_archetype'
  | 'missing_generic_item'
  | 'missing_character'
  | 'missing_initial_state'
  | 'not_equippable'
  | 'not_stackable'
  | 'item_held_elsewhere'

/**
 * One thing that does not hold. `location` is the path of the faulty field
 * (`npcs.athos.combat.weapon`), `reference` what it names, when it names
 * something.
 */
export type CoherenceIssue = {
  code: CoherenceIssueCode
  location: string
  reference?: string
}

export function checkScenario(
  world: WorldLevelContent,
  scenario: ScenarioContent
): CoherenceIssue[] {
  const issues: CoherenceIssue[] = []
  const report = (code: CoherenceIssueCode, location: string, reference?: string) =>
    issues.push(reference === undefined ? { code, location } : { code, location, reference })

  const npcs = overlay(world.npcs, scenario.npcs)
  const locations = overlay(world.locations, scenario.locations)
  const items = overlay(world.items, scenario.items)

  const attributes = referencesOf(world.attributes)
  const skills = referencesOf(world.skills)
  const resources = referencesOf(world.resources)
  const uniqueNpcs = new Set(
    npcs.filter(({ kind }) => kind === 'unique').map(({ reference }) => reference)
  )
  const uniqueLocations = new Set(
    locations.filter(({ kind }) => kind === 'unique').map(({ reference }) => reference)
  )
  const itemsByReference = new Map(items.map((item) => [item.reference, item]))

  /** Every name has an English version, the fallback of every language. */
  const labelled: [string, LabelledEntry[]][] = [
    ['attributes', world.attributes],
    ['skills', world.skills],
    ['resources', world.resources],
    ['glossary', [...world.glossary, ...scenario.glossary]],
    ['npcs', npcs],
    ['locations', locations],
    ['items', items],
    ['chapters', scenario.chapters],
    ['quests', scenario.quests],
  ]
  for (const [list, entries] of labelled) {
    for (const entry of entries) {
      if (!entry.labels.en?.trim()) report('missing_english_label', `${list}.${entry.reference}`)
    }
  }

  for (const skill of world.skills) {
    if (!attributes.has(skill.attribute)) {
      report('unknown_attribute', `skills.${skill.reference}.attribute`, skill.attribute)
    }
  }

  if (world.actionTypes.length === 0) {
    report('no_action_type', 'actionTypes')
  }
  for (const rule of world.actionTypes) {
    if (!skills.has(rule.associatedSkill)) {
      report(
        'unknown_skill',
        `actionTypes.${rule.actionType}.associatedSkill`,
        rule.associatedSkill
      )
    }
  }

  for (const npc of npcs) {
    for (const skill of Object.keys(npc.combat.skills)) {
      if (!skills.has(skill)) report('unknown_skill', `npcs.${npc.reference}.combat.skills`, skill)
    }
    if (npc.combat.weapon !== null && !itemsByReference.has(npc.combat.weapon)) {
      report('unknown_item', `npcs.${npc.reference}.combat.weapon`, npc.combat.weapon)
    }
  }

  for (const location of locations) {
    if (location.parent !== null && !uniqueLocations.has(location.parent)) {
      report('unknown_location', `locations.${location.reference}.parent`, location.parent)
    }
  }

  for (const item of items) {
    item.modifiers.forEach((modifier, index) => {
      if (modifier.target === 'skill' && !skills.has(modifier.skill)) {
        report('unknown_skill', `items.${item.reference}.modifiers.${index}.skill`, modifier.skill)
      }
    })

    const holder = item.initialHolder
    if (holder !== null) {
      const known = holder.holder === 'npc' ? uniqueNpcs : uniqueLocations
      if (!known.has(holder.reference)) {
        report('unknown_holder', `items.${item.reference}.initialHolder`, holder.reference)
      }
    }
  }

  /** What the model improvises from: a passer-by, a place, a thing picked up. */
  if (!npcs.some((npc) => npc.kind === 'archetype' && npc.generic)) {
    report('missing_generic_npc', 'npcs')
  }
  if (!locations.some((location) => location.kind === 'archetype')) {
    report('missing_location_archetype', 'locations')
  }
  if (!items.some((item) => item.kind === 'archetype' && item.generic)) {
    report('missing_generic_item', 'items')
  }

  checkCharacter(scenario, { attributes, skills, resources, itemsByReference }, report)
  checkInitialState(scenario, uniqueLocations, report)

  return issues
}

type Report = (code: CoherenceIssueCode, location: string, reference?: string) => void

function checkCharacter(
  scenario: ScenarioContent,
  known: {
    attributes: Set<string>
    skills: Set<string>
    resources: Set<string>
    itemsByReference: Map<string, ScenarioContent['items'][number]>
  },
  report: Report
) {
  const character = scenario.pregeneratedCharacter

  if (character === null) {
    report('missing_character', 'pregeneratedCharacter')
    return
  }

  const scores: [keyof typeof character & string, Set<string>, CoherenceIssueCode][] = [
    ['attributes', known.attributes, 'unknown_attribute'],
    ['skills', known.skills, 'unknown_skill'],
    ['resources', known.resources, 'unknown_resource'],
  ]
  for (const [field, references, code] of scores) {
    for (const reference of Object.keys(character[field] as Record<string, number>)) {
      if (!references.has(reference)) {
        report(code, `pregeneratedCharacter.${field}`, reference)
      }
    }
  }

  character.items.forEach((entry, index) => {
    const location = `pregeneratedCharacter.items.${index}`
    const item = known.itemsByReference.get(entry.definition)

    if (!item) {
      report('unknown_item', `${location}.definition`, entry.definition)
      return
    }
    if (entry.equipped && !item.equippable) {
      report('not_equippable', `${location}.equipped`, entry.definition)
    }
    if (entry.quantity > 1 && !(item.kind === 'archetype' && item.stackable)) {
      report('not_stackable', `${location}.quantity`, entry.definition)
    }
    /** A unique item exists once: it cannot start with the character and with someone else. */
    if (item.kind === 'unique' && item.initialHolder !== null) {
      report('item_held_elsewhere', `${location}.definition`, entry.definition)
    }
  })
}

function checkInitialState(
  scenario: ScenarioContent,
  uniqueLocations: Set<string>,
  report: Report
) {
  const state = scenario.initialState

  if (state === null) {
    report('missing_initial_state', 'initialState')
    return
  }

  if (!uniqueLocations.has(state.location)) {
    report('unknown_location', 'initialState.location', state.location)
  }
  if (state.chapter !== null && !referencesOf(scenario.chapters).has(state.chapter)) {
    report('unknown_chapter', 'initialState.chapter', state.chapter)
  }

  const quests = referencesOf(scenario.quests)
  state.quests.forEach((quest, index) => {
    if (!quests.has(quest.reference)) {
      report('unknown_quest', `initialState.quests.${index}`, quest.reference)
    }
  })
}

function referencesOf(entries: { reference: string }[]): Set<string> {
  return new Set(entries.map(({ reference }) => reference))
}
