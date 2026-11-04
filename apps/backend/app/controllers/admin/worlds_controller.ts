import db from '@adonisjs/lucid/services/db'

import World from '#models/world'
import ResolutionRule from '#models/resolution_rule'
import { createWorldValidator, updateWorldValidator } from '#validators/content'
import {
  refuseIfPlayed,
  refuseRemovedScores,
  removedReferences,
} from '#services/game/content/usage'
import WorldTransformer from '#transformers/admin/world_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { storeCatalogues, storeProfessions } from '#services/game/content/store'

import { referenceTaken, refuseReferenceChange } from './content.js'
import {
  importedCatalogues,
  refuseImportedCatalogues,
  refuseProfession,
  refuseUnlessOneResolution,
} from './catalogue_checks.js'

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

  /**
   * With what an imported file brings besides — catalogues, lore, categories
   * of action, professions: a world ready to play but for its scenarios. All
   * written in one transaction, or nothing at all.
   */
  async store({ request, response, auth, serialize }: HttpContext) {
    const {
      npcs,
      locations,
      items,
      lore,
      actionTypes = [],
      professions = [],
      ...payload
    } = await request.validateUsing(createWorldValidator)

    if (await World.findBy('reference', payload.reference)) {
      throw referenceTaken(payload.reference)
    }

    const catalogues = importedCatalogues({ npcs, locations, items, lore })
    await refuseImportedCatalogues(catalogues, { worldId: null, scenarioId: null })
    const rules = actionTypes.map((rule, index) => {
      const resolved = {
        actionType: rule.actionType,
        description: rule.description,
        associatedSkill: rule.associatedSkill ?? null,
        associatedCharacteristic: rule.associatedCharacteristic ?? null,
      }
      refuseUnlessOneResolution(resolved, `actionTypes.${index}`)

      return resolved
    })

    /** A profession names what the file itself declares: the world has nothing else yet. */
    const professionScope = {
      skills: new Set(payload.skills.map(({ reference }) => reference)),
      resources: new Set(payload.resources.map(({ reference }) => reference)),
      items: new Set(catalogues.items.map(({ reference }) => reference)),
      scenarioItems: new Set<string>(),
    }
    const imported = professions.map((profession, index) => {
      refuseProfession(profession, professionScope, `professions.${index}.`)

      return {
        ...profession,
        startingItems: profession.startingItems ?? [],
        startingResources: profession.startingResources ?? {},
      }
    })

    const world = await db.transaction(async (trx) => {
      const created = await World.create(
        { ...payload, createdBy: auth.getUserOrFail().id },
        { client: trx }
      )
      await storeCatalogues(created.id, null, catalogues, trx)
      await ResolutionRule.createMany(
        rules.map((rule) => ({ ...rule, worldId: created.id })),
        { client: trx }
      )
      await storeProfessions(created.id, imported, trx)

      return created
    })

    response.status(201)

    return serialize(WorldTransformer.transform(world).useVariant('toDetail'))
  }

  /**
   * Any field but the reference. A list sent replaces the stored one; a skill
   * or resource a character of a game still has cannot be removed from it.
   */
  async update({ params, request, serialize }: HttpContext) {
    const world = await World.findOrFail(params.worldId)
    refuseReferenceChange(request, world.reference)

    const payload = await request.validateUsing(updateWorldValidator)
    const scope = { worldId: world.id }

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
