import World from '#models/world'
import Scenario from '#models/scenario'
import { createScenarioValidator, updateScenarioValidator } from '#validators/content'
import {
  refuseIfPlayed,
  refuseRemovedChapters,
  refuseRemovedQuests,
  removedReferences,
} from '#services/game/content/usage'
import ScenarioTransformer from '#transformers/admin/scenario_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { referenceTaken, refuseReferenceChange } from './content.js'

/** The scenarios of a world, as the back-office edits them. */
export default class ScenariosController {
  async index({ params, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    const scenarios = await Scenario.query().where('worldId', world.id).orderBy('reference')

    return serialize(ScenarioTransformer.transform(scenarios))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(ScenarioTransformer.transform(await Scenario.findOrFail(params.scenarioId)))
  }

  /** Always a draft: publishing checks the whole scenario holds together. */
  async store({ params, request, response, auth, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    const payload = await request.validateUsing(createScenarioValidator)

    const taken = await Scenario.query()
      .where('worldId', world.id)
      .where('reference', payload.reference)
      .first()

    if (taken) {
      throw referenceTaken(payload.reference)
    }

    const scenario = await Scenario.create({
      ...payload,
      worldId: world.id,
      status: 'draft',
      createdBy: auth.getUserOrFail().id,
    })

    response.status(201)

    return serialize(ScenarioTransformer.transform(await scenario.refresh()))
  }

  /**
   * Any field but the reference and the status. A chapter a game stands in,
   * or a quest a game carries, cannot be removed.
   */
  async update({ params, request, serialize }: HttpContext) {
    const scenario = await Scenario.findOrFail(params.scenarioId)
    refuseReferenceChange(request, scenario.reference)

    const payload = await request.validateUsing(updateScenarioValidator)
    const scope = { scenarioId: scenario.id }

    await refuseRemovedChapters(scope, removedReferences(scenario.chapters, payload.chapters))
    await refuseRemovedQuests(scope, removedReferences(scenario.quests, payload.quests))

    await scenario.merge(payload).save()

    return serialize(ScenarioTransformer.transform(scenario))
  }

  /** Only a scenario no game was started from: its own definitions go with it. */
  async destroy({ params, response }: HttpContext) {
    const scenario = await Scenario.findOrFail(params.scenarioId)

    await refuseIfPlayed('scenario', { scenarioId: scenario.id })
    await scenario.delete()

    return response.noContent()
  }
}
