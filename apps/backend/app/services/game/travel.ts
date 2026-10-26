import { FIXED_DURATIONS } from './game_time.js'
import {
  type PassageStates,
  type PlaceDeclaration,
  type Way,
  keyOf,
  networkContainers,
  networkPlaces,
  waysOutOf,
} from './passages.js'

/**
 * Where the character can go from where they stand, by which way, and how
 * long it takes (roadmap, Phase 7). Computed by the backend on every turn,
 * never estimated by the model. Pure: it reads the world and what the game
 * learnt, and writes nothing.
 */

/**
 * What a unique place is to travel:
 *
 * - `free`: no exit — travelled to and from freely, as before networks;
 * - `network`: part of a network, entered and left by its exits only;
 * - `entrance`: part of a network, and where it opens onto the free places;
 * - `container`: the place around a network, never a destination itself.
 */
export type PlaceKind = 'free' | 'network' | 'entrance' | 'container'

/** What a game knows and holds that decides which ways it can take. */
export type TravelState = {
  /** The unique places the game has been to: those it has an instance of. */
  visited: Set<string>
  passages: PassageStates
  /** The item definitions the character holds: one copy opens what it opens. */
  held: Set<string>
  /** The places someone hostile was left in: no way leads through them. */
  guarded: Set<string>
}

/** The way to a place: the passages gone through, in order, and how long it takes. */
export type Route = {
  to: string
  steps: Way[]
  seconds: number
}

/** The places a movement may lead to from where the character stands. */
export type Destinations = {
  /** Unique places, by reference. */
  places: string[]
  /** Whether a new place of an archetype may be improvised. */
  improvise: boolean
}

export function placeKindOf(places: PlaceDeclaration[], reference: string): PlaceKind {
  return kindsOf(places)(reference)
}

/** One reading of the topology, to classify many places against it. */
function kindsOf(places: PlaceDeclaration[]): (reference: string) => PlaceKind {
  const inNetwork = networkPlaces(places)
  const containers = networkContainers(places)
  const entrances = new Set(
    places.filter((place) => place.entrance).map((place) => place.reference)
  )

  return (reference) => {
    if (inNetwork.has(reference)) {
      return entrances.has(reference) ? 'entrance' : 'network'
    }

    return containers.has(reference) ? 'container' : 'free'
  }
}

/**
 * Whether a way can be taken: found if it is hidden from this side, and open
 * — unlocked once and for all, or opened by an item the character holds.
 */
export function isPracticable(way: Way, state: TravelState): boolean {
  const key = keyOf(way.declared)

  if (way.hidden && !state.passages.discovered.has(key)) {
    return false
  }

  return way.requires === null || state.passages.unlocked.has(key) || state.held.has(way.requires)
}

/**
 * The places reachable from `from`, each by its quickest way (Dijkstra, on
 * the time each passage takes). A way only goes on through places already
 * visited: one comes back in a turn to a room known, and discovers new ground
 * room by room. Nor does it go on through a place someone hostile stands in —
 * that place can be reached, not crossed.
 */
export function routesFrom(
  places: PlaceDeclaration[],
  from: string,
  state: TravelState
): Map<string, Route> {
  const best = new Map<string, Route>([[from, { to: from, steps: [], seconds: 0 }]])
  const settled = new Set<string>()

  while (true) {
    const next = [...best.values()]
      .filter((route) => !settled.has(route.to))
      .sort((a, b) => a.seconds - b.seconds || a.steps.length - b.steps.length)[0]

    if (next === undefined) {
      break
    }

    settled.add(next.to)

    const goesOn = next.to === from || (state.visited.has(next.to) && !state.guarded.has(next.to))

    if (!goesOn) {
      continue
    }

    for (const way of waysOutOf(places, next.to)) {
      if (!isPracticable(way, state)) {
        continue
      }

      const seconds = next.seconds + FIXED_DURATIONS[way.duration]
      const known = best.get(way.to)

      if (known === undefined || seconds < known.seconds) {
        best.set(way.to, { to: way.to, steps: [...next.steps, way], seconds })
      }
    }
  }

  best.delete(from)

  return best
}

/**
 * Where a movement may lead from where the character stands:
 *
 * - from a free place (or an improvised one): the free places, the entrances
 *   of the networks, and a new place of an archetype;
 * - from a place of a network: its reachable places only — nothing is
 *   improvised inside a network, whose grain the scenario chose;
 * - from an entrance: both.
 *
 * A place that contains a network is never one of them.
 */
export function destinationsFrom(
  places: PlaceDeclaration[],
  current: string | null,
  state: TravelState
): Destinations {
  const kindOf = kindsOf(places)
  const kind = current === null ? 'free' : kindOf(current)
  const reachable =
    current !== null && (kind === 'network' || kind === 'entrance')
      ? [...routesFrom(places, current, state).keys()]
      : []

  if (kind === 'network') {
    return { places: reachable, improvise: false }
  }

  const open = places
    .filter((place) => place.kind === 'unique')
    .map((place) => place.reference)
    .filter((reference) => ['free', 'entrance'].includes(kindOf(reference)))

  return { places: [...new Set([...reachable, ...open])], improvise: true }
}
