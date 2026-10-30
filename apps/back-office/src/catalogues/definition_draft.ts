import type { FieldErrors } from '@/content/form_errors'
import { labelsOf, rowsOf, type LabelRow } from '@/content/labels'
import i18n from '@/i18n'
import type {
  Catalogue,
  Definition,
  Disposition,
  ItemDefinition,
  ItemHolder,
  Kind,
  LocationDefinition,
  NpcDefinition,
} from './queries'

/**
 * A definition being edited, whatever its catalogue: the fields a catalogue
 * does not have are simply never sent. The structures written by hand — a
 * fighting profile, item modifiers, a weapon profile — are held as the JSON
 * text typed.
 */
export type DefinitionDraft = {
  reference: string
  labels: LabelRow[]
  description: string
  kind: Kind
  generic: boolean
  defaultDisposition: Disposition
  combat: string
  /** A named place, or empty for none. */
  initialLocation: string
  parent: string
  /** JSON text: the exits of a named place. */
  exits: string
  entrance: boolean
  stackable: boolean
  equippable: boolean
  modifiers: string
  /** JSON text; empty for no weapon. */
  weapon: string
  /** `npc:athos`, `location:paris`, or empty for none. */
  initialHolder: string
}

const NEW_COMBAT = { skills: {}, hitPointsMax: 12, weapon: null }

export function emptyDefinitionDraft(): DefinitionDraft {
  return {
    reference: '',
    labels: [{ language: 'en', name: '' }],
    description: '',
    kind: 'unique',
    generic: false,
    defaultDisposition: 'neutral',
    combat: json(NEW_COMBAT),
    initialLocation: '',
    parent: '',
    exits: '[]',
    entrance: false,
    stackable: false,
    equippable: false,
    modifiers: '[]',
    weapon: '',
    initialHolder: '',
  }
}

export function definitionDraftOf(definition: Definition): DefinitionDraft {
  const npc = definition as Partial<NpcDefinition>
  const location = definition as Partial<LocationDefinition>
  const item = definition as Partial<ItemDefinition>

  return {
    ...emptyDefinitionDraft(),
    reference: definition.reference,
    labels: rowsOf(definition.labels),
    description: definition.description,
    kind: definition.kind,
    generic: npc.generic ?? item.generic ?? false,
    defaultDisposition: npc.defaultDisposition ?? 'neutral',
    combat: npc.combat === undefined ? json(NEW_COMBAT) : json(npc.combat),
    initialLocation: npc.initialLocation ?? '',
    parent: location.parent ?? '',
    exits: location.exits === undefined ? '[]' : json(location.exits),
    entrance: location.entrance ?? false,
    stackable: item.stackable ?? false,
    equippable: item.equippable ?? false,
    modifiers: item.modifiers === undefined ? '[]' : json(item.modifiers),
    weapon: item.weapon === undefined || item.weapon === null ? '' : json(item.weapon),
    initialHolder: item.initialHolder
      ? `${item.initialHolder.holder}:${item.initialHolder.reference}`
      : '',
  }
}

export type DefinitionPayload =
  | { payload: Record<string, unknown>; errors?: never }
  | { payload?: never; errors: FieldErrors }

/**
 * The definition as the backend takes it, its catalogue's fields only. What
 * only the other kind may have is left out, so a switch from archetype to
 * unique does not carry a stray parent along. JSON that does not parse is
 * named on its field and nothing is sent.
 */
export function definitionPayloadOf(
  catalogue: Catalogue,
  draft: DefinitionDraft,
  options: { creating: boolean }
): DefinitionPayload {
  const errors: FieldErrors = {}
  const parse = (field: 'combat' | 'modifiers' | 'weapon' | 'exits') => {
    try {
      return JSON.parse(draft[field]) as unknown
    } catch {
      errors[field] = i18n.t('invalid_json', { ns: 'errors' })
      return undefined
    }
  }

  const unique = draft.kind === 'unique'
  const payload: Record<string, unknown> = {
    ...(options.creating ? { reference: draft.reference.trim() } : {}),
    labels: labelsOf(draft.labels),
    description: draft.description.trim(),
    kind: draft.kind,
  }

  if (catalogue === 'npcs') {
    Object.assign(payload, {
      generic: !unique && draft.generic,
      defaultDisposition: draft.defaultDisposition,
      combat: parse('combat'),
      initialLocation: unique && draft.initialLocation !== '' ? draft.initialLocation : null,
    })
  } else if (catalogue === 'locations') {
    Object.assign(payload, {
      parent: unique && draft.parent !== '' ? draft.parent : null,
      exits: unique ? parse('exits') : [],
      entrance: unique && draft.entrance,
    })
  } else {
    Object.assign(payload, {
      generic: !unique && draft.generic,
      stackable: !unique && draft.stackable,
      equippable: draft.equippable,
      modifiers: parse('modifiers'),
      weapon: draft.weapon.trim() === '' ? null : parse('weapon'),
      initialHolder: unique ? holderOf(draft.initialHolder) : null,
    })
  }

  return Object.keys(errors).length > 0 ? { errors } : { payload }
}

function holderOf(value: string): ItemHolder | null {
  const [holder, reference] = value.split(':')

  return (holder === 'npc' || holder === 'location') && reference ? { holder, reference } : null
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
