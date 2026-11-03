import type {
  NpcDefinitionContent,
  ScenarioContent,
  WorldContent,
} from '#services/game/content/types'
import { overlay } from '#services/game/content/resolve'

/** A name as a text would write it: "The library" reads "library" in a sentence. */
const inText = (label: string) => label.replace(/^The /, '').toLowerCase()

/**
 * What the texts of a network give away to the narrator before the character
 * could know it: a passage — or why it is shut — naming the place it leads
 * to, from either side; a room naming one of its neighbours, or a person the
 * character does not know by name yet, in its description or in one of its
 * notes for the time of day. Each as `place: what it names`.
 */
export function giveaways(
  scenario: ScenarioContent,
  worldNpcs: NpcDefinitionContent[],
  container: string
): string[] {
  const rooms = scenario.locations.filter(({ parent }) => parent === container)
  const label = (reference: string) =>
    inText(rooms.find((room) => room.reference === reference)?.labels.en ?? reference)
  const known = new Set(scenario.initialState?.knownNpcs ?? [])
  const strangers = [...worldNpcs, ...scenario.npcs]
    .filter(({ kind, reference }) => kind === 'unique' && !known.has(reference))
    .map(({ labels }) => labels.en)
  const found: string[] = []

  for (const room of rooms) {
    for (const exit of room.exits) {
      if (exit.passage.toLowerCase().includes(label(exit.to))) {
        found.push(`${room.reference} → ${exit.to}: ${exit.passage}`)
      }
      if (exit.backPassage?.toLowerCase().includes(label(room.reference))) {
        found.push(`${exit.to} → ${room.reference}: ${exit.backPassage}`)
      }
      /** Read from either side: it names neither. */
      const reason = exit.blockedReason?.toLowerCase() ?? ''
      for (const end of [exit.to, room.reference]) {
        if (reason.includes(label(end))) {
          found.push(`${room.reference} ↔ ${exit.to}: ${exit.blockedReason}`)
        }
      }
    }

    for (const text of [room.description, ...(room.periodNotes ?? []).map(({ note }) => note)]) {
      const lower = text.toLowerCase()
      for (const neighbour of rooms.filter((other) => other !== room)) {
        if (lower.includes(label(neighbour.reference))) {
          found.push(`${room.reference}: ${neighbour.reference}`)
        }
      }
      for (const name of strangers.filter((stranger) => text.includes(stranger))) {
        found.push(`${room.reference}: ${name}`)
      }
    }
  }

  return found
}

/**
 * What the lore the narrator reads gives away (roadmap, Phase 8): a fragment
 * of ambiance or a fact that is no secret naming a unique person — the name
 * comes by `names`, marked known or not — or, tagged with a room of a
 * network, naming a room next to it. Each as `fragment: what it names`.
 */
export function loreGiveaways(
  world: Omit<WorldContent, 'scenarios'>,
  scenario: ScenarioContent
): string[] {
  const locations = overlay(world.locations, scenario.locations)
  const uniques = overlay(world.npcs, scenario.npcs)
    .filter(({ kind }) => kind === 'unique')
    .map(({ labels }) => labels.en)
  const parentOf = new Map(locations.map(({ reference, parent }) => [reference, parent]))
  const found: string[] = []

  for (const fragment of overlay(world.lore, scenario.lore)) {
    if (fragment.kind === 'rule' || fragment.secret) {
      continue
    }

    for (const name of uniques.filter((unique) => fragment.content.includes(unique))) {
      found.push(`${fragment.reference}: ${name}`)
    }

    const content = fragment.content.toLowerCase()
    const rooms = locations.filter(({ reference, parent, exits }) => {
      const container = parentOf.get(reference)
      return (
        exits.length > 0 &&
        container !== null &&
        !fragment.tags.includes(reference) &&
        fragment.tags.some((tag) => parentOf.get(tag) === container) &&
        parent === container
      )
    })
    for (const room of rooms.filter(({ labels }) => content.includes(inText(labels.en)))) {
      found.push(`${fragment.reference}: ${room.reference}`)
    }
  }

  return found
}
