import World from '#models/world'
import Scenario from '#models/scenario'
import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import LoreFragment from '#models/lore_fragment'
import LocationDefinition from '#models/location_definition'
import { type Catalogue, definitionValidators } from '#validators/content'
import { refuseUsedDefinition } from '#services/game/content/usage'
import DefinitionTransformer from '#transformers/admin/definition_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { referenceTaken, refuseReferenceChange } from './content.js'
import {
  type LorePayload,
  refuseKindMismatch,
  refuseSecretAmbiance,
  refuseUnknownTags,
} from './catalogue_checks.js'

/**
 * The model of each catalogue: the three of definitions share one shape, and
 * the lore its levels and references.
 */
const MODELS = {
  npcs: NpcDefinition,
  locations: LocationDefinition,
  items: ItemDefinition,
  lore: LoreFragment,
} as const

/**
 * What a definition of each catalogue is, for a refused deletion. The lore
 * has none: no game names a fragment, so one can always be deleted.
 */
const KINDS = { npcs: 'npc', locations: 'location', items: 'item', lore: null } as const

/**
 * Typed loosely on purpose: the catalogues are handled by one code path, and
 * the validators already pinned what each one accepts.
 */
type AnyDefinitionModel = typeof NpcDefinition

function modelOf(catalogue: Catalogue): AnyDefinitionModel {
  return MODELS[catalogue] as unknown as AnyDefinitionModel
}

/**
 * The people, places and items of a world or of one of its scenarios, and its
 * lore. A scenario definition sharing the reference of a world one overrides
 * it.
 */
export default class DefinitionsController {
  /** World definitions (`/worlds/:worldId/…`) or a scenario's (`/scenarios/:scenarioId/…`). */
  async index({ params, serialize }: HttpContext) {
    const level = await levelOf(params)
    const definitions = await modelOf(params.catalogue)
      .query()
      .where('worldId', level.worldId)
      .if(
        level.scenarioId === null,
        (query) => query.whereNull('scenarioId'),
        (query) => query.where('scenarioId', level.scenarioId!)
      )
      .orderBy('reference')

    return serialize(DefinitionTransformer.transform(definitions))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const catalogue: Catalogue = params.catalogue
    const level = await levelOf(params)
    const payload = (await request.validateUsing(
      definitionValidators[catalogue].create as never
    )) as { reference: string }
    const Model = modelOf(catalogue)

    const taken = await Model.query()
      .where('worldId', level.worldId)
      .where('reference', payload.reference)
      .if(
        level.scenarioId === null,
        (query) => query.whereNull('scenarioId'),
        (query) => query.where('scenarioId', level.scenarioId!)
      )
      .first()

    if (taken) {
      throw referenceTaken(payload.reference)
    }

    if (catalogue === 'lore') {
      await refuseUnknownTags(payload as unknown as LorePayload, level)
      refuseSecretAmbiance(payload as unknown as LorePayload)
    } else {
      refuseKindMismatch(payload)
    }

    const definition = await Model.create({ ...payload, ...level } as never)

    response.status(201)

    return serialize(DefinitionTransformer.transform(await definition.refresh()))
  }

  async update({ params, request, serialize }: HttpContext) {
    const catalogue: Catalogue = params.catalogue
    const definition = await modelOf(catalogue).findOrFail(params.definitionId)
    refuseReferenceChange(request, definition.reference)

    const payload = await request.validateUsing(definitionValidators[catalogue].update as never)
    definition.merge(payload as never)

    if (catalogue === 'lore') {
      const fragment = definition.$attributes as LorePayload
      await refuseUnknownTags(fragment, definition)
      refuseSecretAmbiance(fragment)
    } else {
      refuseKindMismatch(definition.$attributes)
    }

    await definition.save()

    return serialize(DefinitionTransformer.transform(definition))
  }

  /**
   * Only a definition no game made an instance of — in the games of its
   * scenario for a scenario definition, of its whole world otherwise.
   */
  async destroy({ params, response }: HttpContext) {
    const catalogue: Catalogue = params.catalogue
    const definition = await modelOf(catalogue).findOrFail(params.definitionId)
    const kind = KINDS[catalogue]

    if (kind !== null) {
      await refuseUsedDefinition(
        kind,
        definition.scenarioId === null
          ? { worldId: definition.worldId }
          : { scenarioId: definition.scenarioId },
        definition.reference
      )
    }
    await definition.delete()

    return response.noContent()
  }
}

/** The level a definition belongs to, from the route: the world's, or a scenario's. */
async function levelOf(params: Record<string, string>) {
  if (params.scenarioId) {
    const scenario = await Scenario.findOrFail(params.scenarioId)

    return { worldId: scenario.worldId, scenarioId: scenario.id as string | null }
  }

  const world = await World.findOrFail(params.worldId)

  return { worldId: world.id, scenarioId: null as string | null }
}
