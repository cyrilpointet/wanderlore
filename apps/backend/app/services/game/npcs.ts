import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import NpcInstance from '#models/npc_instance'
import Scenario from '#models/scenario'
import { DOWN_AT } from '#services/rules/engine'

import type { ContentLabels } from './content_labels.js'
import { placeInitialItems } from './inventory.js'
import { Opponents } from './opponents.js'
import { bringPending, pendingNpcs } from './pending_effects.js'
import { lastEntryAt } from './schedules.js'

import type { NpcDefinition, NpcDisposition, WorldDefinition } from './world.js'

/** Someone entering the scene, as the extraction step will propose it. */
export type NpcEntry = {
  /** From the closed list of NPC definitions. */
  definition: string
  /** Free English text with no mechanical reach: "the one with the scar". */
  descriptor: string | null
  /**
   * A proper name the narration gave as they came in. Kept on a new instance;
   * a unique character met again keeps the name it already had.
   */
  name?: string | null
}

/**
 * A person present in the scene, as the turn context carries it. The model
 * designates them by handle alone; the descriptor is what lets it tell two
 * guards apart.
 */
export type PresentNpc = {
  handle: string
  name: string | null
  descriptor: string | null
  disposition: NpcDisposition
  /**
   * How they stand, qualitatively: on their feet, down — out of the fight at
   * 2 hit points or fewer — or dying, which they do at the end of the next
   * turn unless tended. Never a number.
   */
  condition: NpcCondition
}

export type NpcCondition = 'standing' | 'down' | 'dying'

/** In the scene: present, or dying where they fell — for one turn, to be tended or finished. */
export const IN_SCENE: string[] = ['present', 'dying']

export function conditionOf(npc: { status: string; hitPoints: number | null }): NpcCondition {
  if (npc.status === 'dying') return 'dying'

  return npc.hitPoints !== null && npc.hitPoints <= DOWN_AT ? 'down' : 'standing'
}

/**
 * A definition outside the closed list. It is checked before anything is
 * applied, so reaching this is a bug upstream — never a reason to create
 * someone with state of their own that nothing defines.
 */
export class UnknownNpcError extends Error {
  readonly world: string
  readonly reference: string

  constructor(world: string, reference: string) {
    super(`"${reference}" is not an NPC definition of the ${world} world.`)
    this.name = 'UnknownNpcError'
    this.world = world
    this.reference = reference
  }
}

/** A unique character who died in this game: they cannot walk back in. */
export class DeadNpcError extends Error {
  readonly handle: string

  constructor(handle: string) {
    super(`"${handle}" is dead in this game and cannot enter the scene.`)
    this.name = 'DeadNpcError'
    this.handle = handle
  }
}

/**
 * Brings someone into the scene.
 *
 * - a unique character already met is made present again, never duplicated;
 * - a unique character who died is refused;
 * - an archetype gets a new instance, numbered by the backend within the game
 *   (`cardinal_guard_1`, `cardinal_guard_2`), never by the model.
 *
 * A new instance starts with the disposition and the hit points its
 * definition declares, and a unique character met for the first time comes in
 * with the items they hold from the start. Turns of a game are played one at a
 * time, so counting is enough to number; the unique `(session_id, handle)` is
 * the last line of defence.
 *
 * Whoever comes in is where the scene is, `place`: left there when the
 * character moves on, and found there again.
 */
export async function enterScene(
  world: WorldDefinition,
  sessionId: string,
  entry: NpcEntry,
  client?: QueryClientContract,
  place: string | null = null
): Promise<NpcInstance> {
  const definition = world.npcs.find((npc) => npc.reference === entry.definition)

  if (definition === undefined) {
    throw new UnknownNpcError(world.reference, entry.definition)
  }

  if (definition.kind === 'unique') {
    const known = await NpcInstance.query({ client })
      .where('sessionId', sessionId)
      .where('handle', definition.reference)
      .first()

    if (known !== null) {
      if (known.status === 'dead') {
        throw new DeadNpcError(known.handle)
      }

      /** Read through the same client, so saved within the same transaction. */
      known.status = 'present'
      known.locationInstanceId = place
      await known.save()

      return known
    }
  }

  return createInstance(world, sessionId, definition, entry, { status: 'present', place }, client)
}

/**
 * A new instance, numbered by the backend when it is of an archetype, with the
 * disposition and the hit points its definition declares — and, for a unique
 * character, the items they hold from the start.
 */
async function createInstance(
  world: WorldDefinition,
  sessionId: string,
  definition: NpcDefinition,
  entry: NpcEntry,
  at: { status: 'present' | 'absent'; place: string | null },
  client?: QueryClientContract
): Promise<NpcInstance> {
  const handle =
    definition.kind === 'unique'
      ? definition.reference
      : `${definition.reference}_${(await countOf(sessionId, definition.reference, client)) + 1}`

  const instance = await NpcInstance.create(
    {
      sessionId,
      handle,
      definitionReference: definition.reference,
      descriptor: entry.descriptor,
      name: entry.name ?? null,
      disposition: definition.defaultDisposition,
      status: at.status,
      hitPoints: definition.combat.hitPointsMax,
      locationInstanceId: at.place,
    },
    { client }
  )

  if (definition.kind === 'unique') {
    await placeInitialItems(
      world,
      sessionId,
      { type: 'npc', id: instance.id },
      definition.reference,
      client
    )
    /** What an event left with them before they existed. */
    await bringPending(world, sessionId, { npc: definition.reference }, client)
  }

  return instance
}

/**
 * Someone the backend brings in itself — an event, a schedule — rather than
 * extraction: a new instance where `at` says, numbered like any other. A
 * unique person who already has one is never given a second.
 */
export async function placeNpc(
  world: WorldDefinition,
  sessionId: string,
  definition: NpcDefinition,
  at: { status: 'present' | 'absent'; place: string | null; descriptor?: string | null },
  client?: QueryClientContract
): Promise<NpcInstance> {
  return createInstance(
    world,
    sessionId,
    definition,
    { definition: definition.reference, descriptor: at.descriptor ?? null },
    { status: at.status, place: at.place },
    client
  )
}

export type UniqueNpc = Extract<NpcDefinition, { kind: 'unique' }>

/**
 * Where a unique person the game has not met is to be found, as the clock
 * stands: where their schedule last sent them — unless it stopped — or else
 * the place they wait in from the start. Null: nowhere in particular.
 */
export function expectedPlaceOf(
  npc: UniqueNpc,
  clock: { gameTime: number; stopped: Set<string> } | null
): string | null {
  if (clock !== null && npc.schedule.length > 0 && !clock.stopped.has(npc.reference)) {
    return lastEntryAt(npc.schedule, clock.gameTime)?.location ?? npc.initialLocation
  }

  return npc.initialLocation
}

/**
 * The unique people the game has not met who are to be found in a place: by
 * their schedule when `clock` is given and they have one, by the place they
 * wait in from the start otherwise. Someone an event sent elsewhere before
 * they were met is wherever it sent them, not here.
 */
async function placedUnmet(
  world: WorldDefinition,
  sessionId: string,
  place: string,
  client?: QueryClientContract,
  clock: { gameTime: number; stopped: Set<string> } | null = null
): Promise<UniqueNpc[]> {
  const placed = world.npcs.filter(
    (npc): npc is UniqueNpc =>
      npc.kind === 'unique' &&
      (clock === null && npc.schedule.length > 0 ? false : expectedPlaceOf(npc, clock) === place)
  )
  if (placed.length === 0) {
    return []
  }

  const met = await metNpcs(sessionId, client)
  const sent = await pendingNpcs(sessionId, client)
  return placed.filter((npc) => !met.has(npc.reference) && !sent.has(npc.reference))
}

/**
 * Brings into the game the unique people who wait in a named place from the
 * start, the first time the game visits it — as the items kept there come
 * into being with it. They wait there, absent, until the character arrives:
 * arriving is what makes whoever waits in a place present. A unique character
 * already met elsewhere is never created again. Someone with a schedule is
 * placed by it instead (`bringScheduled`).
 */
export async function placeInitialNpcs(
  world: WorldDefinition,
  sessionId: string,
  place: { id: string; reference: string },
  client?: QueryClientContract
): Promise<NpcInstance[]> {
  const placed: NpcInstance[] = []

  for (const definition of await placedUnmet(world, sessionId, place.reference, client)) {
    placed.push(
      await createInstance(
        world,
        sessionId,
        definition,
        { definition: definition.reference, descriptor: null },
        { status: 'absent', place: place.id },
        client
      )
    )
  }

  return placed
}

/** Whoever was left in a place, or waits there from the start, is there still. The dead stay dead. */
export async function meetThoseWaiting(
  sessionId: string,
  placeId: string,
  client?: QueryClientContract
): Promise<void> {
  await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .where('status', 'absent')
    .where('locationInstanceId', placeId)
    .update({ status: 'present' })
}

/** The definitions of everyone the game has met, whatever became of them since. */
export async function metNpcs(
  sessionId: string,
  client?: QueryClientContract
): Promise<Set<string>> {
  const npcs = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .select('definitionReference')

  return new Set(npcs.map(({ definitionReference }) => definitionReference))
}

/**
 * Who extraction may bring into a scene: every archetype, every unique
 * character met before or waiting nowhere in particular — and a unique one
 * who waits in a place from the start only while the scene is in that place,
 * or within reach of it. Nobody comes out of their guardroom before the game
 * gets near it; met, they are free to go wherever the story takes them.
 */
export function enterableNpcs(
  world: WorldDefinition,
  met: Set<string>,
  around: Set<string>,
  clock: { gameTime: number; stopped: Set<string> } | null = null
): string[] {
  return world.npcs
    .filter((npc) => {
      if (npc.kind === 'archetype' || met.has(npc.reference)) {
        return true
      }

      const place = expectedPlaceOf(npc, clock)

      return place === null || around.has(place)
    })
    .map((npc) => npc.reference)
}

/**
 * The people present in a game, oldest first, in the shape the turn context
 * carries. Absent and dead ones stay out: the cost of the context stays
 * bounded however long the game runs.
 */
export async function presentNpcs(
  sessionId: string,
  client?: QueryClientContract
): Promise<PresentNpc[]> {
  const npcs = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .whereIn('status', IN_SCENE)
    .orderBy('createdAt', 'asc')
    /** Two entries in the same millisecond still come out in a stable order. */
    .orderBy('handle', 'asc')

  return npcs.map((npc) => ({
    handle: npc.handle,
    name: npc.name,
    descriptor: npc.descriptor,
    disposition: npc.disposition,
    condition: conditionOf(npc),
  }))
}

/** The definition of each person present, by handle: what names them when they have no name of their own. */
export async function presentNpcDefinitions(
  sessionId: string,
  client?: QueryClientContract
): Promise<Record<string, string>> {
  const npcs = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .whereIn('status', IN_SCENE)

  return Object.fromEntries(
    npcs.map(({ handle, definitionReference }) => [handle, definitionReference])
  )
}

/**
 * The handle the next instance of an archetype will get: what the round
 * calls an improvised opponent before the turn brings them in, under the
 * same number — turns of a game are played one at a time.
 */
export async function nextHandleOf(
  sessionId: string,
  definition: string,
  client?: QueryClientContract
): Promise<string> {
  return `${definition}_${(await countOf(sessionId, definition, client)) + 1}`
}

async function countOf(
  sessionId: string,
  definition: string,
  client?: QueryClientContract
): Promise<number> {
  const row = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .where('definitionReference', definition)
    .count('* as total')
    .firstOrFail()

  return Number(row.$extras.total)
}

/**
 * Who waits in a place, left there earlier and alive: whom the character
 * finds on arriving. Named the way the scene names people present, with their
 * definition for a name they never gave. Those who wait there from the start
 * and have not been met yet are `npcsPlacedIn`.
 */
export async function npcsWaitingIn(
  sessionId: string,
  placeHandle: string,
  client?: QueryClientContract
): Promise<(PresentNpc & { definition: string })[]> {
  const npcs = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .where('status', 'absent')
    .whereHas('location', (location) => location.where('handle', placeHandle))
    .orderBy('createdAt', 'asc')
    .orderBy('handle', 'asc')

  return npcs.map((npc) => ({
    handle: npc.handle,
    name: npc.name,
    descriptor: npc.descriptor,
    disposition: npc.disposition,
    condition: conditionOf(npc),
    definition: npc.definitionReference,
  }))
}

/**
 * The places someone hostile was left in, by the reference of their
 * definition: a way does not go on through them.
 */
export async function guardedPlaces(
  sessionId: string,
  client?: QueryClientContract
): Promise<Set<string>> {
  const npcs = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .where('status', 'absent')
    .where('disposition', 'hostile')
    .whereNotNull('locationInstanceId')
    .preload('location')

  return new Set(npcs.map(({ location }) => location.definitionReference))
}

/**
 * Who waits in a named place from the start and has not been met yet, in the
 * shape of `npcsWaitingIn`: whom the character will find there on a first
 * visit. Their handle is their reference, as it will be once they exist.
 */
export async function npcsPlacedIn(
  world: WorldDefinition,
  sessionId: string,
  place: string,
  client?: QueryClientContract,
  clock: { gameTime: number; stopped: Set<string> } | null = null
): Promise<(PresentNpc & { definition: string })[]> {
  const placed = await placedUnmet(world, sessionId, place, client, clock)

  return placed.map((npc) => ({
    handle: npc.reference,
    name: null,
    descriptor: null,
    disposition: npc.defaultDisposition,
    condition: 'standing' as const,
    definition: npc.reference,
  }))
}

/** The people of a game, read where they stand, with what the character knows of them. */
export async function loadOpponents(
  session: { id: string; scenarioId: string },
  world: WorldDefinition,
  labels: ContentLabels,
  knownNpcs: string[],
  client?: QueryClientContract
): Promise<Opponents> {
  const people = await NpcInstance.query({ client })
    .where('sessionId', session.id)
    .orderBy('createdAt', 'asc')
    .orderBy('handle', 'asc')
  const scenario = await Scenario.findOrFail(session.scenarioId, { client })

  return new Opponents(labels, world, people, {
    initially: scenario.initialState?.knownNpcs ?? [],
    now: knownNpcs,
  })
}
