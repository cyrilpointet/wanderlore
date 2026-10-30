import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import NpcInstance from '#models/npc_instance'

import { placeInitialItems } from './inventory.js'

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
  }

  return instance
}

/** The unique people who wait in a place from the start, and have not been met yet. */
async function placedUnmet(
  world: WorldDefinition,
  sessionId: string,
  place: string,
  client?: QueryClientContract
): Promise<Extract<NpcDefinition, { kind: 'unique' }>[]> {
  const placed = world.npcs.filter(
    (npc): npc is Extract<NpcDefinition, { kind: 'unique' }> =>
      npc.kind === 'unique' && npc.initialLocation === place
  )
  if (placed.length === 0) {
    return []
  }

  const met = await metNpcs(sessionId, client)
  return placed.filter((npc) => !met.has(npc.reference))
}

/**
 * Brings into the game the unique people who wait in a named place from the
 * start, the first time the game visits it — as the items kept there come
 * into being with it. They wait there, absent, until the character arrives:
 * arriving is what makes whoever waits in a place present. A unique character
 * already met elsewhere is never created again.
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
  around: Set<string>
): string[] {
  return world.npcs
    .filter(
      (npc) =>
        npc.kind === 'archetype' ||
        npc.initialLocation === null ||
        met.has(npc.reference) ||
        around.has(npc.initialLocation)
    )
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
    .where('status', 'present')
    .orderBy('createdAt', 'asc')
    /** Two entries in the same millisecond still come out in a stable order. */
    .orderBy('handle', 'asc')

  return npcs.map(({ handle, name, descriptor, disposition }) => ({
    handle,
    name,
    descriptor,
    disposition,
  }))
}

/** The definition of each person present, by handle: what names them when they have no name of their own. */
export async function presentNpcDefinitions(
  sessionId: string,
  client?: QueryClientContract
): Promise<Record<string, string>> {
  const npcs = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .where('status', 'present')

  return Object.fromEntries(
    npcs.map(({ handle, definitionReference }) => [handle, definitionReference])
  )
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

  return npcs.map(({ handle, name, descriptor, disposition, definitionReference }) => ({
    handle,
    name,
    descriptor,
    disposition,
    definition: definitionReference,
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
  client?: QueryClientContract
): Promise<(PresentNpc & { definition: string })[]> {
  const placed = await placedUnmet(world, sessionId, place, client)

  return placed.map((npc) => ({
    handle: npc.reference,
    name: null,
    descriptor: null,
    disposition: npc.defaultDisposition,
    definition: npc.reference,
  }))
}
