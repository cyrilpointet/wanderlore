import { BaseTransformer } from '@adonisjs/core/transformers'

import type NpcDefinition from '#models/npc_definition'
import type ItemDefinition from '#models/item_definition'
import type LoreFragment from '#models/lore_fragment'
import type LocationDefinition from '#models/location_definition'

type Definition = NpcDefinition | LocationDefinition | ItemDefinition | LoreFragment

/** Columns every catalogue shares, then each catalogue's own. */
const SHARED = ['id', 'worldId', 'scenarioId', 'reference']

/** What the three catalogues of definitions share beyond. */
const DEFINED = ['labels', 'description', 'kind']

const OWN: Record<string, string[]> = {
  npc_definitions: [
    ...DEFINED,
    'generic',
    'defaultDisposition',
    'combat',
    'initialLocation',
    'schedule',
  ],
  location_definitions: [...DEFINED, 'parent', 'exits', 'entrance', 'periodNotes'],
  item_definitions: [
    ...DEFINED,
    'generic',
    'stackable',
    'equippable',
    'modifiers',
    'weapon',
    'armor',
    'initialHolder',
    'hidden',
  ],
  lore_fragments: ['kind', 'content', 'tags', 'secret'],
}

/** A definition of one of the catalogues, or a lore fragment, as the back-office edits it. */
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
