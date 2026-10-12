import World from '#models/world'
import { createWorldValidator, updateWorldValidator } from '#validators/content'
import {
  refuseIfPlayed,
  refuseRemovedScores,
  removedReferences,
} from '#services/game/content/usage'
import WorldTransformer from '#transformers/admin/world_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { referenceTaken, refuseReferenceChange } from './content.js'

/** The worlds of the game, as the back-office edits them. Game masters only. */
export default class WorldsController {
  async index({ serialize }: HttpContext) {
    const worlds = await World.query().withCount('scenarios').orderBy('reference')

    return serialize(WorldTransformer.transform(worlds))
  }

  async show({ params, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)

    return serialize(WorldTransformer.transform(world).useVariant('toDetail'))
  }

  async store({ request, response, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(createWorldValidator)

    if (await World.findBy('reference', payload.reference)) {
      throw referenceTaken(payload.reference)
    }

    const world = await World.create({ ...payload, createdBy: auth.getUserOrFail().id })

    response.status(201)

    return serialize(WorldTransformer.transform(world).useVariant('toDetail'))
  }

  /**
   * Any field but the reference. A list sent replaces the stored one; an
   * attribute, skill or resource a character of a game still has cannot be
   * removed from it.
   */
  async update({ params, request, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    refuseReferenceChange(request, world.reference)

    const payload = await request.validateUsing(updateWorldValidator)
    const scope = { worldId: world.id }

    await refuseRemovedScores(
      'attribute',
      scope,
      removedReferences(world.attributes, payload.attributes)
    )
    await refuseRemovedScores('skill', scope, removedReferences(world.skills, payload.skills))
    await refuseRemovedScores(
      'resource',
      scope,
      removedReferences(world.resources, payload.resources)
    )

    await world.merge(payload).save()

    return serialize(WorldTransformer.transform(world).useVariant('toDetail'))
  }

  /** Only a world no game was ever played in: its scenarios and catalogues go with it. */
  async destroy({ params, response }: HttpContext) {
    const world = await World.findOrFail(params.worldId)

    await refuseIfPlayed('world', { worldId: world.id })
    await world.delete()

    return response.noContent()
  }
}
