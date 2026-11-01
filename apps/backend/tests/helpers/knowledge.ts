import type { NpcDefinitionContent, ScenarioContent } from '#services/game/content/types'

/** A name as a text would write it: "The library" reads "library" in a sentence. */
const inText = (label: string) => label.replace(/^The /, '').toLowerCase()

/**
 * What the texts of a network give away to the narrator before the character
 * could know it: a passage naming the place it leads to, from either side; a
 * room naming one of its neighbours, or a person the character does not know
 * by name yet. Each as `place: what it names`.
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
    }

    const description = room.description.toLowerCase()
    for (const neighbour of rooms.filter((other) => other !== room)) {
      if (description.includes(label(neighbour.reference))) {
        found.push(`${room.reference}: ${neighbour.reference}`)
      }
    }
    for (const name of strangers.filter((stranger) => room.description.includes(stranger))) {
      found.push(`${room.reference}: ${name}`)
    }
  }

  return found
}
