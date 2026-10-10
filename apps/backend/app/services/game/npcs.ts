import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import NpcInstance from '#models/npc_instance'

import type { NpcDisposition, WorldDefinition } from './world.js'

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
 * A new instance starts with the disposition its definition declares. Turns of
 * a game are played one at a time, so counting is enough to number; the
 * unique `(session_id, handle)` is the last line of defence.
 */
export async function enterScene(
  world: WorldDefinition,
  sessionId: string,
  entry: NpcEntry,
  client?: QueryClientContract
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
      await known.save()

      return known
    }
  }

  const handle =
    definition.kind === 'unique'
      ? definition.reference
      : `${definition.reference}_${(await countOf(sessionId, definition.reference, client)) + 1}`

  return NpcInstance.create(
    {
      sessionId,
      handle,
      definitionReference: definition.reference,
      descriptor: entry.descriptor,
      name: entry.name ?? null,
      disposition: definition.defaultDisposition,
      status: 'present',
    },
    { client }
  )
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
