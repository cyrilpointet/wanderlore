import { isDiceExpression } from '#services/rules/dice_expression'
import { FIXED_DURATIONS } from '#services/game/game_time'
import { networkContainers, networksOf, passageBetween } from '#services/game/passages'

import {
  COMBAT_ACTION_TYPES,
  SYSTEM_ACTION_TYPES,
  SYSTEM_SKILLS,
} from '#services/game/system_references'

import { overlay, type WorldLevelContent } from './resolve.js'
import {
  CHARACTERISTICS,
  type EventCondition,
  type EventEffect,
  type ItemDefinitionContent,
  type LabelledEntry,
  type LocationDefinitionContent,
  type NpcDefinitionContent,
  type ScenarioContent,
  type ScenarioEvent,
  type StartingItem,
} from './types.js'

/**
 * Whether a world and one of its scenarios hold together well enough to be
 * played: every reference names something that exists, the model has the
 * generic archetypes it improvises from, a character can be made in the world
 * and equipped for the story, and a game has a place to start in.
 *
 * Checked when a scenario is published, and again when a game is started
 * from it: content edited after publication cannot slip a broken scenario
 * past the players. Pure, so the checks run without a database.
 */

export type CoherenceIssueCode =
  | 'missing_english_label'
  | 'unknown_characteristic'
  | 'invalid_dice'
  | 'unknown_skill'
  | 'unknown_resource'
  | 'unknown_location'
  | 'unknown_item'
  | 'unknown_holder'
  | 'unknown_npc'
  | 'unknown_chapter'
  | 'unknown_quest'
  | 'unknown_tag'
  | 'no_action_type'
  | 'missing_system_reference'
  | 'combat_needs_skill'
  | 'not_a_weapon'
  | 'missing_generic_npc'
  | 'missing_location_archetype'
  | 'missing_generic_item'
  | 'no_profession'
  | 'item_given_twice'
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
  | 'unknown_flag'
  | 'not_unique'
  | 'unknown_passage'
  | 'schedule_overlap'
  | 'event_without_trigger'
  | 'event_cycle'
  | 'no_victory_event'
  | 'game_ended_twice'

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

/**
 * What the backend reads for itself (roadmap, Phase 10): the categories of
 * action the round and first aid are worked out from, and the dodge skill.
 * Both attacking categories are resolved by a skill — the parry and the
 * riposte of a person, who has no characteristics, read it.
 */
export function systemReferenceIssues(
  world: Pick<WorldLevelContent, 'actionTypes' | 'skills'>
): CoherenceIssue[] {
  const issues: CoherenceIssue[] = []
  const declared = new Map(world.actionTypes.map((rule) => [rule.actionType, rule]))
  const skills = referencesOf(world.skills)

  for (const actionType of SYSTEM_ACTION_TYPES) {
    if (!declared.has(actionType)) {
      issues.push({
        code: 'missing_system_reference',
        location: 'actionTypes',
        reference: actionType,
      })
    }
  }
  for (const actionType of COMBAT_ACTION_TYPES) {
    if (declared.get(actionType)?.associatedSkill === null) {
      issues.push({
        code: 'combat_needs_skill',
        location: `actionTypes.${actionType}.associatedSkill`,
        reference: actionType,
      })
    }
  }
  for (const skill of SYSTEM_SKILLS) {
    if (!skills.has(skill)) {
      issues.push({ code: 'missing_system_reference', location: 'skills', reference: skill })
    }
  }

  return issues
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
    ['professions', world.professions],
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
  for (const issue of systemReferenceIssues(world)) {
    issues.push(issue)
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
    } else if (
      npc.combat.weapon !== null &&
      itemsByReference.get(npc.combat.weapon)!.weapon === null
    ) {
      report('not_a_weapon', `npcs.${npc.reference}.combat.weapon`, npc.combat.weapon)
    }
    if (npc.combat.damageModifier !== null && !isDiceExpression(npc.combat.damageModifier)) {
      report(
        'invalid_dice',
        `npcs.${npc.reference}.combat.damageModifier`,
        npc.combat.damageModifier
      )
    }
    /** Where a unique person waits from the start: a named place, like an item's holder. */
    if (npc.initialLocation !== null && !uniqueLocations.has(npc.initialLocation)) {
      report('unknown_location', `npcs.${npc.reference}.initialLocation`, npc.initialLocation)
    }
    checkSchedule(npc, uniqueLocations, report)
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

  /**
   * A tag is what sends a fragment: a place, a person or an item the scene can
   * hold. Any other word would never match, and the fragment never be sent.
   */
  const taggable = new Set([...npcs, ...locations, ...items].map(({ reference }) => reference))
  for (const fragment of overlay(world.lore, scenario.lore)) {
    for (const tag of fragment.tags) {
      if (!taggable.has(tag)) report('unknown_tag', `lore.${fragment.reference}.tags`, tag)
    }
  }

  checkEvents(scenario, { npcs, locations, items }, report)
  checkStartingEquipment(world, scenario, { skills, resources, itemsByReference }, report)
  checkInitialState(scenario, { uniqueLocations, uniqueNpcs }, report)
  checkNetworks(locations, scenario, report)

  return issues
}

type Report = (code: CoherenceIssueCode, location: string, reference?: string) => void

/**
 * What a character starts a game with: their profession's equipment, then the
 * scenario's (roadmap, Phase 12). Each item resolves on the world and the
 * scenario together — a scenario definition overrides a profession's item of
 * the same reference — and a unique item is given once at most, whatever
 * profession the player picks.
 */
function checkStartingEquipment(
  world: WorldLevelContent,
  scenario: ScenarioContent,
  known: {
    skills: Set<string>
    resources: Set<string>
    itemsByReference: Map<string, ItemDefinitionContent>
  },
  report: Report
) {
  /** A world without a profession has no character to play its scenarios with. */
  if (world.professions.length === 0) {
    report('no_profession', 'professions')
  }

  const checkItems = (path: string, items: StartingItem[]) => {
    const uniques: string[] = []

    items.forEach((entry, index) => {
      const location = `${path}.${index}`
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
      if (item.kind === 'unique') {
        /** A unique item exists once: it cannot start with the character and with someone else. */
        if (item.initialHolder !== null) {
          report('item_held_elsewhere', `${location}.definition`, entry.definition)
        }
        uniques.push(entry.definition)
      }
    })

    return uniques
  }

  const checkResources = (path: string, resources: Record<string, number>) => {
    for (const reference of Object.keys(resources)) {
      if (!known.resources.has(reference)) report('unknown_resource', path, reference)
    }
  }

  const fromScenario = checkItems('startingKit.items', scenario.startingKit.items)
  checkResources('startingKit.resources', scenario.startingKit.resources)

  const twice = (path: string, uniques: string[]) => {
    const seen = new Set<string>()

    for (const reference of uniques) {
      if (seen.has(reference)) report('item_given_twice', path, reference)
      seen.add(reference)
    }
  }
  twice('startingKit.items', fromScenario)

  for (const profession of world.professions) {
    const path = `professions.${profession.reference}`

    for (const skill of profession.skills) {
      if (!known.skills.has(skill)) report('unknown_skill', `${path}.skills`, skill)
    }
    checkResources(`${path}.startingResources`, profession.startingResources)

    const fromProfession = checkItems(`${path}.startingItems`, profession.startingItems)
    twice(`${path}.startingItems`, fromProfession)
    /** The same unique item from the profession and from the scenario: one of them gets nothing. */
    for (const reference of new Set(fromProfession)) {
      if (fromScenario.includes(reference)) {
        report('item_given_twice', `${path}.startingItems`, reference)
      }
    }
  }
}

function checkInitialState(
  scenario: ScenarioContent,
  known: { uniqueLocations: Set<string>; uniqueNpcs: Set<string> },
  report: Report
) {
  const { uniqueLocations, uniqueNpcs } = known
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

  /** Only a named person has a name to know: an archetype's people are anonymous. */
  for (const [index, reference] of (state.knownNpcs ?? []).entries()) {
    if (!uniqueNpcs.has(reference)) {
      report('unknown_npc', `initialState.knownNpcs.${index}`, reference)
    }
  }
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

/** A schedule sends a person to named places, and each period of the day to one of them at most. */
function checkSchedule(npc: NpcDefinitionContent, uniqueLocations: Set<string>, report: Report) {
  const taken = new Set<string>()

  ;(npc.schedule ?? []).forEach((entry, index) => {
    const path = `npcs.${npc.reference}.schedule.${index}`

    if (!uniqueLocations.has(entry.location)) {
      report('unknown_location', `${path}.location`, entry.location)
    }
    for (const period of entry.periods) {
      if (taken.has(period)) report('schedule_overlap', `${path}.periods`, period)
      taken.add(period)
    }
  })
}

type EventCatalogues = {
  npcs: NpcDefinitionContent[]
  locations: LocationDefinitionContent[]
  items: ItemDefinitionContent[]
}

/**
 * Every event names what exists: unique people and items — an archetype has
 * no one instance to look at or move — named places, declared flags, the
 * passages of the world. Each has something to set it off, and no chain of
 * events sets itself off again.
 */
function checkEvents(scenario: ScenarioContent, known: EventCatalogues, report: Report) {
  const flags = referencesOf(scenario.flags ?? [])
  const npcs = new Map(known.npcs.map((npc) => [npc.reference, npc]))
  const items = new Map(known.items.map((item) => [item.reference, item]))
  const places = new Set(
    known.locations.filter(({ kind }) => kind === 'unique').map(({ reference }) => reference)
  )

  const person = (path: string, reference: string, archetypeToo = false) => {
    const npc = npcs.get(reference)
    if (npc === undefined) report('unknown_npc', path, reference)
    else if (npc.kind !== 'unique' && !archetypeToo) report('not_unique', path, reference)
  }
  const item = (path: string, reference: string, archetypeToo = false) => {
    const definition = items.get(reference)
    if (definition === undefined) report('unknown_item', path, reference)
    else if (definition.kind !== 'unique' && !archetypeToo) report('not_unique', path, reference)
  }
  const place = (path: string, reference: string) => {
    if (!places.has(reference)) report('unknown_location', path, reference)
  }
  const holder = (path: string, to: { holder: string; reference?: string }) => {
    if (to.holder === 'npc') person(`${path}.reference`, to.reference!)
    if (to.holder === 'location') place(`${path}.reference`, to.reference!)
  }
  const flag = (path: string, reference: string) => {
    if (!flags.has(reference)) report('unknown_flag', path, reference)
  }

  const checkCondition = (path: string, condition: EventCondition) => {
    switch (condition.type) {
      case 'flag':
        return flag(`${path}.flag`, condition.flag)
      case 'item_held_by':
        item(`${path}.item`, condition.item)
        return holder(`${path}.holder`, condition.holder)
      case 'item_gone':
        return item(`${path}.item`, condition.item)
      case 'npc_dead':
      case 'npc_disposition':
        return person(`${path}.npc`, condition.npc)
      case 'npc_at':
        person(`${path}.npc`, condition.npc)
        return place(`${path}.location`, condition.location)
      case 'location_visited':
        return place(`${path}.location`, condition.location)
    }
  }

  const checkEffect = (path: string, effect: EventEffect) => {
    switch (effect.type) {
      case 'npc_moved':
        person(`${path}.npc`, effect.npc)
        return place(`${path}.location`, effect.location)
      case 'npc_entered':
        person(`${path}.npc`, effect.npc, true)
        return place(`${path}.location`, effect.location)
      case 'npc_left':
      case 'npc_disposition':
      case 'schedule_stopped':
        return person(`${path}.npc`, effect.npc)
      case 'passage_blocked':
      case 'passage_cleared':
      case 'passage_discovered':
      case 'passage_unlocked':
        place(`${path}.from`, effect.from)
        place(`${path}.to`, effect.to)
        if (passageBetween(known.locations, effect.from, effect.to) === null) {
          report('unknown_passage', path, `${effect.from}|${effect.to}`)
        }
        return
      case 'place_note_set':
      case 'place_note_cleared':
        return place(`${path}.location`, effect.location)
      case 'item_placed':
        item(`${path}.item`, effect.item, true)
        return holder(`${path}.holder`, effect.holder)
      case 'item_transferred':
        item(`${path}.item`, effect.item)
        return holder(`${path}.holder`, effect.holder)
      case 'item_gone':
        return item(`${path}.item`, effect.item)
      case 'flag_set':
        return flag(`${path}.flag`, effect.flag)
      case 'character_harmed':
        /** Nothing to look up: its dice were checked with the shape. */
        return
      case 'game_ended':
        return
    }
  }

  for (const event of scenario.events ?? []) {
    const path = `events.${event.reference}`

    if (event.when.at === null && event.when.conditions.length === 0) {
      report('event_without_trigger', `${path}.when`, event.reference)
    }
    if (event.place !== null) place(`${path}.place`, event.place)

    event.when.conditions.forEach((condition, index) =>
      checkCondition(`${path}.when.conditions.${index}`, condition)
    )
    event.unless.forEach((condition, index) => checkCondition(`${path}.unless.${index}`, condition))
    ;(event.foreseeable ?? []).forEach((condition, index) =>
      checkCondition(`${path}.foreseeable.${index}`, condition)
    )
    event.effects.forEach((effect, index) => checkEffect(`${path}.effects.${index}`, effect))

    /** One event ends the game one way: won and lost at once means nothing. */
    if (event.effects.filter(({ type }) => type === 'game_ended').length > 1) {
      report('game_ended_twice', `${path}.effects`, event.reference)
    }
  }

  /** A story that cannot be won is no story to play (roadmap, Phase 12). */
  const wins = (scenario.events ?? []).some((event) =>
    event.effects.some((effect) => effect.type === 'game_ended' && effect.outcome === 'completed')
  )
  if (!wins) {
    report('no_victory_event', 'events')
  }

  for (const reference of eventCycle(scenario.events ?? [])) {
    report('event_cycle', `events.${reference}`, reference)
  }
}

/**
 * The events of a chain that leads back to itself: an effect of one makes a
 * condition of the next hold, round to the first. Each event falls once, so
 * the game would never loop — but the author meant something else.
 */
export function eventCycle(events: ScenarioEvent[]): string[] {
  const keysOf = (effect: EventEffect): string[] => {
    switch (effect.type) {
      case 'flag_set':
        return [`flag:${effect.flag}`]
      case 'npc_moved':
      case 'npc_entered':
        return [`npc_at:${effect.npc}:${effect.location}`]
      case 'npc_disposition':
        return [`npc_disposition:${effect.npc}:${effect.disposition}`]
      case 'item_placed':
      case 'item_transferred':
        return [`item_held_by:${effect.item}:${holderKey(effect.holder)}`]
      case 'item_gone':
        return [`item_gone:${effect.item}`]
      default:
        return []
    }
  }
  const keyOf = (condition: EventCondition): string | null => {
    switch (condition.type) {
      case 'flag':
        return `flag:${condition.flag}`
      case 'npc_at':
        return `npc_at:${condition.npc}:${condition.location}`
      case 'npc_disposition':
        return `npc_disposition:${condition.npc}:${condition.disposition}`
      case 'item_held_by':
        return `item_held_by:${condition.item}:${holderKey(condition.holder)}`
      case 'item_gone':
        return `item_gone:${condition.item}`
      default:
        return null
    }
  }

  /** Each event leads to those whose conditions one of its effects makes hold. */
  const next = new Map(
    events.map((event) => {
      const made = new Set(event.effects.flatMap(keysOf))

      return [
        event.reference,
        events
          .filter((other) =>
            other.when.conditions.some((condition) => {
              const key = keyOf(condition)
              return key !== null && made.has(key)
            })
          )
          .map(({ reference }) => reference),
      ]
    })
  )

  const state = new Map<string, 'open' | 'done'>()
  const stack: string[] = []

  const visit = (reference: string): string[] | null => {
    if (state.get(reference) === 'done') return null
    if (state.get(reference) === 'open') return stack.slice(stack.indexOf(reference))

    state.set(reference, 'open')
    stack.push(reference)
    for (const following of next.get(reference) ?? []) {
      const cycle = visit(following)
      if (cycle !== null) return cycle
    }
    stack.pop()
    state.set(reference, 'done')

    return null
  }

  for (const { reference } of events) {
    const cycle = visit(reference)
    if (cycle !== null) return cycle
  }

  return []
}

function holderKey(holder: { holder: string; reference?: string }): string {
  return holder.holder === 'character' ? 'character' : `${holder.holder}:${holder.reference}`
}

function isCharacteristic(value: string): boolean {
  return (CHARACTERISTICS as readonly string[]).includes(value)
}

function referencesOf(entries: { reference: string }[]): Set<string> {
  return new Set(entries.map(({ reference }) => reference))
}
