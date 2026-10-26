import { DateTime } from 'luxon'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import PassageState from '#models/passage_state'

import type { FixedDuration } from './game_time.js'
import type { LocationExit } from './content/types.js'

/**
 * Passages between places (roadmap, Phase 7): how they read from either side,
 * the networks they draw, and what a game learnt of them.
 *
 * A passage is declared once, on one side, and leads both ways unless it is
 * one-way. The topology is pure, so the content checks and the turn read it
 * the same way, from content as written or from a resolved world; only what a
 * game found or opened lives in the database.
 */

/** A place as the topology reads it: a content definition or a resolved one. */
export type PlaceDeclaration = {
  reference: string
  kind: 'unique' | 'archetype'
  parent?: string | null
  exits?: LocationExit[]
  entrance?: boolean
}

/**
 * What names a passage in a game: the place that declares it and the place
 * it leads to. At most one passage joins two places, so the pair is enough,
 * whichever way the passage is gone through.
 */
export type PassageKey = {
  from: string
  to: string
}

/** A way out of a place, read from that place. */
export type Way = {
  /** The place it leads to. */
  to: string
  /** One line of English, as seen from here. */
  passage: string
  /** Hidden from here: a passage is only ever hidden from the side that declares it so. */
  hidden: boolean
  /** The item that opens it, from either side. */
  requires: string | null
  /** How long going through takes; a moment when the content says nothing. */
  duration: FixedDuration
  /** The passage it goes through, as declared. */
  declared: PassageKey
}

/** What a game learnt of its passages, by `keyOf`. */
export type PassageStates = {
  discovered: Set<string>
  unlocked: Set<string>
}

export const NO_PASSAGE_STATE: PassageStates = { discovered: new Set(), unlocked: new Set() }

/**
 * A passage outside the world's. The closed lists are checked before anything
 * is applied, so reaching this is a bug upstream.
 */
export class UnknownPassageError extends Error {
  readonly from: string
  readonly to: string

  constructor(passage: PassageKey) {
    super(`No passage leads from "${passage.from}" to "${passage.to}".`)
    this.name = 'UnknownPassageError'
    this.from = passage.from
    this.to = passage.to
  }
}

export function keyOf(passage: PassageKey): string {
  return `${passage.from}>${passage.to}`
}

/** Every passage of the world, each once, as declared. */
export function passagesOf(places: PlaceDeclaration[]): (PassageKey & { exit: LocationExit })[] {
  return places
    .filter((place) => place.kind === 'unique')
    .flatMap((place) =>
      (place.exits ?? []).map((exit) => ({ from: place.reference, to: exit.to, exit }))
    )
}

/**
 * The ways out of a place: the exits it declares, then the passages declared
 * on the far side that lead back to it, unless they are one-way.
 */
export function waysOutOf(places: PlaceDeclaration[], from: string): Way[] {
  return passagesOf(places).flatMap(({ from: declaredIn, to, exit }): Way[] => {
    const declared = { from: declaredIn, to }
    const duration = exit.duration ?? 'moment'

    if (declaredIn === from) {
      return [
        {
          to,
          passage: exit.passage,
          hidden: exit.hidden,
          requires: exit.requires,
          duration,
          declared,
        },
      ]
    }

    if (to === from && !exit.oneWay) {
      return [
        {
          to: declaredIn,
          passage: exit.backPassage ?? exit.passage,
          hidden: false,
          requires: exit.requires,
          duration,
          declared,
        },
      ]
    }

    return []
  })
}

/** The unique places a passage touches, from either side: the places of a network. */
export function networkPlaces(places: PlaceDeclaration[]): Set<string> {
  return new Set(passagesOf(places).flatMap(({ from, to }) => [from, to]))
}

/**
 * The networks of the world: the places joined by passages, one set per
 * group of places that reach one another, whichever way the passages lead.
 */
export function networksOf(places: PlaceDeclaration[]): Set<string>[] {
  const neighbours = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b))
  }

  for (const { from, to } of passagesOf(places)) {
    link(from, to)
    link(to, from)
  }

  const networks: Set<string>[] = []
  const seen = new Set<string>()

  for (const start of neighbours.keys()) {
    if (seen.has(start)) {
      continue
    }

    const network = new Set<string>([start])
    const queue = [start]
    seen.add(start)

    while (queue.length > 0) {
      for (const next of neighbours.get(queue.shift()!) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          network.add(next)
          queue.push(next)
        }
      }
    }

    networks.push(network)
  }

  return networks
}

/**
 * The places that contain a network without being part of it — the house
 * around its rooms. Being "in the house" without being in one of its rooms
 * means nothing, so none of them is a destination; they remain parents.
 */
export function networkContainers(places: PlaceDeclaration[]): Set<string> {
  const inNetwork = networkPlaces(places)

  return new Set(
    places
      .filter((place) => place.kind === 'unique' && inNetwork.has(place.reference))
      .map((place) => place.parent)
      .filter((parent): parent is string => typeof parent === 'string' && !inNetwork.has(parent))
  )
}

/** What a game found or opened so far. */
export async function passageStates(
  sessionId: string,
  client?: QueryClientContract
): Promise<PassageStates> {
  const rows = await PassageState.query({ client }).where('sessionId', sessionId)

  const keysWhere = (column: 'discoveredAt' | 'unlockedAt') =>
    new Set(
      rows
        .filter((row) => row[column] !== null)
        .map((row) => keyOf({ from: row.fromReference, to: row.toReference }))
    )

  return { discovered: keysWhere('discoveredAt'), unlocked: keysWhere('unlockedAt') }
}

/** A hidden passage found. Found again, it keeps the moment it was first found. */
export function discoverPassage(
  places: PlaceDeclaration[],
  sessionId: string,
  passage: PassageKey,
  client?: QueryClientContract
): Promise<void> {
  return record(places, sessionId, passage, 'discoveredAt', client)
}

/** A locked passage opened, for good: both ways through it share it. */
export function unlockPassage(
  places: PlaceDeclaration[],
  sessionId: string,
  passage: PassageKey,
  client?: QueryClientContract
): Promise<void> {
  return record(places, sessionId, passage, 'unlockedAt', client)
}

async function record(
  places: PlaceDeclaration[],
  sessionId: string,
  passage: PassageKey,
  column: 'discoveredAt' | 'unlockedAt',
  client?: QueryClientContract
): Promise<void> {
  const known = passagesOf(places).some(
    ({ from, to }) => from === passage.from && to === passage.to
  )

  if (!known) {
    throw new UnknownPassageError(passage)
  }

  const state = await PassageState.firstOrCreate(
    { sessionId, fromReference: passage.from, toReference: passage.to },
    {},
    { client }
  )

  if (state[column] === null || state[column] === undefined) {
    state[column] = DateTime.now()
    await state.save()
  }
}
