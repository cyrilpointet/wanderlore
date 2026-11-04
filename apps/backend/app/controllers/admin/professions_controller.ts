import World from '#models/world'
import Profession from '#models/profession'
import { createProfessionValidator, updateProfessionValidator } from '#validators/content'
import { refuseUsedProfession } from '#services/game/content/usage'
import ProfessionTransformer from '#transformers/admin/profession_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { referenceTaken, refuseReferenceChange } from './content.js'
import { professionScopeOf, refuseProfession } from './catalogue_checks.js'

/**
 * The professions of a world, which a player picks for their character. At
 * world level only: no scenario overrides a profession.
 */
export default class ProfessionsController {
  async index({ params, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    const professions = await Profession.query().where('worldId', world.id).orderBy('reference')

    return serialize(ProfessionTransformer.transform(professions))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    const payload = await request.validateUsing(createProfessionValidator)

    const taken = await Profession.query()
      .where('worldId', world.id)
      .where('reference', payload.reference)
      .first()

    if (taken) {
      throw referenceTaken(payload.reference)
    }

    refuseProfession(payload, await professionScopeOf(world))

    const profession = await Profession.create({
      startingItems: [],
      startingResources: {},
      ...payload,
      worldId: world.id,
    })

    response.status(201)

    return serialize(ProfessionTransformer.transform(await profession.refresh()))
  }

  /** Anything but the reference; a character keeps their profession, and reads it as it stands. */
  async update({ params, request, serialize }: HttpContext) {
    const profession = await Profession.query()
      .where('id', params.professionId)
      .preload('world')
      .firstOrFail()
    refuseReferenceChange(request, profession.reference)

    const payload = await request.validateUsing(updateProfessionValidator)
    profession.merge(payload)
    refuseProfession(profession, await professionScopeOf(profession.world))

    await profession.save()

    return serialize(ProfessionTransformer.transform(profession))
  }

  /** Only a profession no character follows, deleted or not. */
  async destroy({ params, response }: HttpContext) {
    const profession = await Profession.findOrFail(params.professionId)

    await refuseUsedProfession(profession)
    await profession.delete()

    return response.noContent()
  }
}
