import { isDiceExpression } from '#services/rules/dice_expression'
import { FIXED_DURATIONS } from '#services/game/game_time'
import { networkContainers, networksOf } from '#services/game/passages'

import { overlay, type WorldLevelContent } from './resolve.js'
import {
  CHARACTERISTICS,
  type LabelledEntry,
  type LocationDefinitionContent,
  type ScenarioContent,
} from './types.js'

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
  | 'unknown_characteristic'
  | 'characteristic_out_of_range'
  | 'invalid_dice'
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
  | 'exit_to_itself'
  | 'duplicate_passage'
  | 'invalid_duration'
  | 'entrance_without_exits'
  | 'unreachable_network'
  | 'start_contains_network'

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
    if (
      typeof skill.baseChance !== 'number' &&
      !isCharacteristic(skill.baseChance.characteristic)
    ) {
      report(
        'unknown_characteristic',
        `skills.${skill.reference}.baseChance.characteristic`,
        skill.baseChance.characteristic
      )
    }
  }

  if (world.actionTypes.length === 0) {
    report('no_action_type', 'actionTypes')
  }
  for (const rule of world.actionTypes) {
    if (rule.associatedSkill !== null && !skills.has(rule.associatedSkill)) {
      report(
        'unknown_skill',
        `actionTypes.${rule.actionType}.associatedSkill`,
        rule.associatedSkill
      )
    }
    if (
      rule.associatedCharacteristic !== null &&
      !isCharacteristic(rule.associatedCharacteristic)
    ) {
      report(
        'unknown_characteristic',
        `actionTypes.${rule.actionType}.associatedCharacteristic`,
        rule.associatedCharacteristic
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
    /** Where a unique person waits from the start: a named place, like an item's holder. */
    if (npc.initialLocation !== null && !uniqueLocations.has(npc.initialLocation)) {
      report('unknown_location', `npcs.${npc.reference}.initialLocation`, npc.initialLocation)
    }
  }

  for (const location of locations) {
    if (location.parent !== null && !uniqueLocations.has(location.parent)) {
      report('unknown_location', `locations.${location.reference}.parent`, location.parent)
    }
  }

  checkExits(locations, { uniqueLocations, items: itemsByReference }, report)

  for (const item of items) {
    item.modifiers.forEach((modifier, index) => {
      if (!skills.has(modifier.skill)) {
        report('unknown_skill', `items.${item.reference}.modifiers.${index}.skill`, modifier.skill)
      }
    })

    if (item.weapon !== null) {
      if (!skills.has(item.weapon.skill)) {
        report('unknown_skill', `items.${item.reference}.weapon.skill`, item.weapon.skill)
      }
      if (!isDiceExpression(item.weapon.damage)) {
        report('invalid_dice', `items.${item.reference}.weapon.damage`, item.weapon.damage)
      }
    }

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

  checkCharacter(scenario, { skills, resources, itemsByReference }, report)
  checkInitialState(scenario, uniqueLocations, report)
  checkNetworks(locations, scenario, report)

  return issues
}

type Report = (code: CoherenceIssueCode, location: string, reference?: string) => void

function checkCharacter(
  scenario: ScenarioContent,
  known: {
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

  for (const characteristic of CHARACTERISTICS) {
    const score = character.characteristics?.[characteristic]
    const [min, max] = CHARACTERISTIC_RANGE[characteristic] ?? HUMAN_RANGE

    if (typeof score !== 'number' || !Number.isInteger(score) || score < min || score > max) {
      report(
        'characteristic_out_of_range',
        `pregeneratedCharacter.characteristics.${characteristic}`,
        characteristic
      )
    }
  }
  for (const reference of Object.keys(character.characteristics ?? {})) {
    if (!isCharacteristic(reference)) {
      report('unknown_characteristic', 'pregeneratedCharacter.characteristics', reference)
    }
  }

  const scores: [keyof typeof character & string, Set<string>, CoherenceIssueCode][] = [
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

/**
 * Every exit leads to another unique place, at most one passage joins two
 * places, and what it requires and how long it lasts are known.
 */
function checkExits(
  locations: LocationDefinitionContent[],
  known: { uniqueLocations: Set<string>; items: Map<string, unknown> },
  report: Report
) {
  const passages = new Set<string>()

  for (const location of locations) {
    location.exits.forEach((exit, index) => {
      const path = `locations.${location.reference}.exits.${index}`
      const pair = [location.reference, exit.to].sort().join('|')

      if (exit.to === location.reference) {
        report('exit_to_itself', `${path}.to`, exit.to)
      } else if (!known.uniqueLocations.has(exit.to)) {
        report('unknown_location', `${path}.to`, exit.to)
      } else if (passages.has(pair)) {
        /** Twice on one side, or once on each: either way the game could not tell them apart. */
        report('duplicate_passage', path, exit.to)
      }
      passages.add(pair)

      if (exit.requires !== null && !known.items.has(exit.requires)) {
        report('unknown_item', `${path}.requires`, exit.requires)
      }
      if (exit.duration !== null && !Object.hasOwn(FIXED_DURATIONS, exit.duration)) {
        report('invalid_duration', `${path}.duration`, exit.duration)
      }
    })
  }
}

/**
 * Networks a game can reach and stand in: an entrance is part of a network,
 * a network without one is where the story starts (a prison one escapes is a
 * choice; a network nothing leads to is a mistake), and the story never
 * starts in a place that only contains a network.
 */
function checkNetworks(
  locations: LocationDefinitionContent[],
  scenario: ScenarioContent,
  report: Report
) {
  const networks = networksOf(locations)
  const inNetwork = new Set(networks.flatMap((network) => [...network]))
  const start = scenario.initialState?.location

  for (const location of locations) {
    if (location.entrance && !inNetwork.has(location.reference)) {
      report(
        'entrance_without_exits',
        `locations.${location.reference}.entrance`,
        location.reference
      )
    }
  }

  for (const network of networks) {
    const entered = locations.some(
      (location) => location.entrance && network.has(location.reference)
    )

    if (!entered && (start === undefined || !network.has(start))) {
      const [first] = [...network].sort()
      report('unreachable_network', `locations.${first}`, first)
    }
  }

  if (start !== undefined && networkContainers(locations).has(start)) {
    report('start_contains_network', 'initialState.location', start)
  }
}

/** A human's characteristics: 3 to 21, INT and SIZ at least 8 (rules, section 3). */
const HUMAN_RANGE: [number, number] = [3, 21]
const CHARACTERISTIC_RANGE: Partial<Record<string, [number, number]>> = {
  INT: [8, 21],
  SIZ: [8, 21],
}

function isCharacteristic(value: string): boolean {
  return (CHARACTERISTICS as readonly string[]).includes(value)
}

function referencesOf(entries: { reference: string }[]): Set<string> {
  return new Set(entries.map(({ reference }) => reference))
}
