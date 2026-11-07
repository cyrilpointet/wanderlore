import type { ItemsInScene } from '#services/game/inventory'
import type { LoreFragmentKind } from '#services/game/content/types'
import type { LoreFragmentContent, WorldDefinition } from '#services/game/world'

/**
 * Which lore a step of the turn is given (roadmap, Phase 8). Pure: arbitration
 * and narration read it, never the model, and the log says what was sent.
 *
 * Selected by the scene, never by the player's text: the backend knows the
 * place, its parents, who is present and what is held, whatever language the
 * player writes in. A fragment goes when the scene holds one of its tags; a
 * fragment without tags always goes.
 */

/** The steps that read lore. Extraction reads the narration, not the world. */
export type LoreStep = 'arbitration' | 'narration'

/** The kinds each step is sent: rules to the arbiter, ambiance to the narrator, facts to both. */
const KINDS: Record<LoreStep, LoreFragmentKind[]> = {
  arbitration: ['rule', 'fact'],
  narration: ['ambiance', 'fact'],
}

/**
 * How many tagged fragments a step is sent at most, the ones without tags
 * aside: past it, the least specific are left out. Fixed in the code, like
 * the rest of the context's budget; to adjust from `llm:cost`.
 */
export const TAGGED_LORE_CAP = 12

/**
 * What the scene holds, by definition reference, most specific first: the
 * place, then what contains it from the closest outwards, then the people
 * present, then the items in sight or in hand.
 */
export type LoreScene = {
  places: string[]
  npcs: string[]
  items: string[]
}

/** A place of the game, as the scene holds it: its definition, and the named place an improvised one stands in. */
export type ScenePlace = {
  definitionReference: string
  parentReference: string | null
}

/**
 * The places a scene stands in, from the place itself outwards: a named
 * place's parents as the catalogue declares them, an improvised place's
 * parent and that parent's own.
 */
export function placesOf(world: WorldDefinition, place: ScenePlace | null): string[] {
  if (place === null) {
    return []
  }

  const parents = new Map(
    world.locations.map((location) => [
      location.reference,
      location.kind === 'unique' ? location.parent : null,
    ])
  )
  const places = [place.definitionReference]
  let parent = parents.get(place.definitionReference) ?? place.parentReference

  /** A catalogue never loops, but content is edited by hand: stop on a place seen twice. */
  while (parent !== null && !places.includes(parent)) {
    places.push(parent)
    parent = parents.get(parent) ?? null
  }

  return places
}

/** The scene as a turn holds it: the place, who is present by handle, what is held. */
export type TurnScene = {
  place: ScenePlace | null
  npc_definitions: Record<string, string>
  items: ItemsInScene
}

/**
 * Where the narration takes the character, when arbitration named a place:
 * staging the arrival calls for the lore of where they arrive, and of who
 * waits there.
 */
export type Arrival = {
  destination: string
  npcs: string[]
}

/**
 * What a turn's scene holds, as tags: where it stands — and where it arrives,
 * for the narration of a movement — then who is there, then the items.
 */
export function loreSceneOf(
  world: WorldDefinition,
  scene: TurnScene,
  arrival: Arrival | null = null
): LoreScene {
  const here = placesOf(world, scene.place)
  const there =
    arrival === null
      ? []
      : placesOf(world, { definitionReference: arrival.destination, parentReference: null })
  const { character, npcs, location } = scene.items

  return {
    places: [...here.slice(0, 1), ...there.slice(0, 1), ...here.slice(1), ...there.slice(1)],
    npcs: [...Object.values(scene.npc_definitions), ...(arrival?.npcs ?? [])],
    /** A hidden item calls for its lore only once found: nothing gives it away before. */
    items: [
      ...character,
      ...npcs.flatMap(({ items }) => items),
      ...location.filter(({ hidden }) => !hidden),
    ].map(({ definition }) => definition),
  }
}

/**
 * The fragments one step is sent, in order: those without tags, then the
 * tagged ones the scene calls for, the most specific first, at most
 * `TAGGED_LORE_CAP` of them. A secret fragment never reaches the narration.
 */
export function loreFor(
  world: WorldDefinition,
  step: LoreStep,
  scene: LoreScene
): LoreFragmentContent[] {
  const fragments = world.lore.filter(
    (fragment) =>
      KINDS[step].includes(fragment.kind) && (step === 'arbitration' || !fragment.secret)
  )
  const priority = new Map<string, number>()

  for (const tag of [...scene.places, ...scene.npcs, ...scene.items]) {
    if (!priority.has(tag)) {
      priority.set(tag, priority.size)
    }
  }

  const rankOf = (fragment: LoreFragmentContent) =>
    Math.min(...fragment.tags.map((tag) => priority.get(tag) ?? Number.POSITIVE_INFINITY))

  const always = fragments.filter((fragment) => fragment.tags.length === 0)
  const called = fragments
    .filter((fragment) => fragment.tags.length > 0)
    .map((fragment) => ({ fragment, rank: rankOf(fragment) }))
    .filter(({ rank }) => rank !== Number.POSITIVE_INFINITY)
    /** Stable: two fragments of the same rank keep the order of the catalogue. */
    .sort((a, b) => a.rank - b.rank)
    .slice(0, TAGGED_LORE_CAP)
    .map(({ fragment }) => fragment)

  return [...always, ...called]
}

/** References of the fragments sent, as logged. */
export function loreReferences(fragments: LoreFragmentContent[]): string[] {
  return fragments.map(({ reference }) => reference)
}
