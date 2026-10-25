import World from '#models/world'
import { Refusal } from '#exceptions/refusal'
import ResolutionRule from '#models/resolution_rule'
import { createActionTypeValidator, updateActionTypeValidator } from '#validators/content'
import { refuseRemovedActionTypes } from '#services/game/content/usage'
import ActionTypeTransformer from '#transformers/admin/action_type_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { referenceTaken, refuseReferenceChange } from './content.js'

/** The categories of action of a world, each tied to the skill or characteristic that resolves it. */
export default class ActionTypesController {
  async index({ params, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    const rules = await ResolutionRule.query().where('worldId', world.id).orderBy('actionType')

    return serialize(ActionTypeTransformer.transform(rules))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    const payload = await request.validateUsing(createActionTypeValidator)

    const taken = await ResolutionRule.query()
      .where('worldId', world.id)
      .where('actionType', payload.actionType)
      .first()

    if (taken) {
      throw referenceTaken(payload.actionType)
    }

    const resolution = {
      associatedSkill: payload.associatedSkill ?? null,
      associatedCharacteristic: payload.associatedCharacteristic ?? null,
    }
    refuseUnlessOneResolution(resolution)

    const rule = await ResolutionRule.create({
      actionType: payload.actionType,
      description: payload.description,
      ...resolution,
      worldId: world.id,
    })

    response.status(201)

    return serialize(ActionTypeTransformer.transform(rule))
  }

  /** The description and what resolves it; the category's own reference never changes. */
  async update({ params, request, serialize }: HttpContext) {
    const rule = await ResolutionRule.findOrFail(params.id)

    if (
      request.input('actionType') !== undefined &&
      request.input('actionType') !== rule.actionType
    ) {
      refuseReferenceChange(request, rule.actionType)
    }

    const payload = await request.validateUsing(updateActionTypeValidator)
    refuseUnlessOneResolution({
      associatedSkill:
        payload.associatedSkill === undefined ? rule.associatedSkill : payload.associatedSkill,
      associatedCharacteristic:
        payload.associatedCharacteristic === undefined
          ? rule.associatedCharacteristic
          : payload.associatedCharacteristic,
    })

    await rule.merge(payload).save()

    return serialize(ActionTypeTransformer.transform(rule))
  }

  /** Only a category no logged roll of a game resolved. */
  async destroy({ params, response }: HttpContext) {
    const rule = await ResolutionRule.findOrFail(params.id)

    await refuseRemovedActionTypes({ worldId: rule.worldId }, [rule.actionType])
    await rule.delete()

    return response.noContent()
  }
}

/**
 * A skill or a characteristic, exactly one: the table refuses anything else,
 * but with a message the back-office cannot show.
 */
function refuseUnlessOneResolution(resolution: {
  associatedSkill: string | null
  associatedCharacteristic: string | null
}) {
  const set = [resolution.associatedSkill, resolution.associatedCharacteristic].filter(
    (value) => value !== null
  )

  if (set.length !== 1) {
    throw new Refusal(
      422,
      'one_resolution',
      'A category of action is resolved by a skill or by a characteristic, exactly one of them.'
    )
  }
}
