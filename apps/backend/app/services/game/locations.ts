import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import LocationInstance from '#models/location_instance'

import {
  type WorldDefinition,
  locationArchetypeReferences,
  uniqueLocationReferences,
} from './world.js'

/** A new place of an archetype, as the extraction step will propose it. */
export type ImprovisedLocation = {
  /** From the closed list of archetypes. */
  definition: string
  /** From the closed list of unique places. */
  parent: string
  name: string | null
  descriptor: string | null
}

/**
 * A place outside the list it had to come from. The closed lists are checked
 * before anything is applied, so reaching this is a bug upstream — never a
 * reason to create an instance nothing could label.
 */
export class UnknownLocationError extends Error {
  readonly world: string
  readonly reference: string

  constructor(world: string, reference: string, list: string) {
    super(`"${reference}" is not one of the ${list} of the ${world} world.`)
    this.name = 'UnknownLocationError'
    this.world = world
    this.reference = reference
  }
}

/**
 * The instance of a unique place in a game: created on its first visit, with
 * the reference itself for handle, and found again on every later one. A
 * unique place is never duplicated.
 */
export async function visitUniqueLocation(
  world: WorldDefinition,
  sessionId: string,
  reference: string,
  client?: QueryClientContract
): Promise<LocationInstance> {
  if (!uniqueLocationReferences(world).includes(reference)) {
    throw new UnknownLocationError(world.reference, reference, 'unique places')
  }

  return LocationInstance.firstOrCreate(
    { sessionId, handle: reference },
    { definitionReference: reference, parentReference: null },
    { client }
  )
}

/**
 * A new instance of an archetype, numbered by the backend within the game
 * (`tavern_1`, `tavern_2`), never by the model. Going back to an improvised
 * place is not tracked before Phase 7: every call is a new place.
 *
 * Turns of a game are played one at a time, so counting is enough; the unique
 * `(session_id, handle)` is the last line of defence.
 */
export async function improviseLocation(
  world: WorldDefinition,
  sessionId: string,
  place: ImprovisedLocation,
  client?: QueryClientContract
): Promise<LocationInstance> {
  if (!locationArchetypeReferences(world).includes(place.definition)) {
    throw new UnknownLocationError(world.reference, place.definition, 'place archetypes')
  }

  if (!uniqueLocationReferences(world).includes(place.parent)) {
    throw new UnknownLocationError(world.reference, place.parent, 'unique places')
  }

  const existing = await LocationInstance.query({ client })
    .where('sessionId', sessionId)
    .where('definitionReference', place.definition)
    .count('* as total')
    .firstOrFail()

  return LocationInstance.create(
    {
      sessionId,
      handle: `${place.definition}_${Number(existing.$extras.total) + 1}`,
      definitionReference: place.definition,
      parentReference: place.parent,
      name: place.name,
      descriptor: place.descriptor,
    },
    { client }
  )
}
