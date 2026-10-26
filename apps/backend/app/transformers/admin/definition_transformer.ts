import { BaseTransformer } from '@adonisjs/core/transformers'

import type NpcDefinition from '#models/npc_definition'
import type ItemDefinition from '#models/item_definition'
import type LocationDefinition from '#models/location_definition'

type Definition = NpcDefinition | LocationDefinition | ItemDefinition

/** Columns every catalogue shares, then each catalogue's own. */
const SHARED = ['id', 'worldId', 'scenarioId', 'reference', 'labels', 'description', 'kind']

const OWN: Record<string, string[]> = {
  npc_definitions: ['generic', 'defaultDisposition', 'combat'],
  location_definitions: ['parent', 'exits', 'entrance'],
  item_definitions: ['generic', 'stackable', 'equippable', 'modifiers', 'initialHolder'],
}

/** A definition of one of the three catalogues, as the back-office edits it. */
export default class DefinitionTransformer extends BaseTransformer<Definition> {
  toObject() {
    const definition = this.resource
    const table = (definition.constructor as unknown as { table: string }).table
    const fields = [...SHARED, ...(OWN[table] ?? []), 'updatedAt']

    return Object.fromEntries(
      fields.map((field) => [field, (definition as unknown as Record<string, unknown>)[field]])
    )
  }
}
