import type { FieldErrors } from '@/content/form_errors'
import { labelsOf, rowsOf, type LabelRow } from '@/content/labels'
import i18n from '@/i18n'
import type { Profession, ProfessionPayload } from './queries'

/**
 * A profession being edited. Its skills are picked from the world's; its
 * starting equipment and resources are held as the JSON text typed.
 */
export type ProfessionDraft = {
  reference: string
  labels: LabelRow[]
  description: string
  skills: string[]
  /** JSON text: a list of items, empty for none. */
  startingItems: string
  /** JSON text: resources by reference, empty for none. */
  startingResources: string
}

export function emptyProfessionDraft(): ProfessionDraft {
  return {
    reference: '',
    labels: [{ language: 'en', name: '' }],
    description: '',
    skills: [],
    startingItems: '[]',
    startingResources: '{}',
  }
}

export function professionDraftOf(profession: Profession): ProfessionDraft {
  return {
    reference: profession.reference,
    labels: rowsOf(profession.labels),
    description: profession.description,
    skills: profession.skills,
    startingItems: json(profession.startingItems ?? []),
    startingResources: json(profession.startingResources ?? {}),
  }
}

/** What is sent: the reference only when creating, for it never changes afterwards. */
export type ProfessionSent = Omit<ProfessionPayload, 'reference'> & { reference?: string }

export type ProfessionBuilt =
  | { payload: ProfessionSent; errors?: never }
  | { payload?: never; errors: FieldErrors }

/**
 * The profession as the backend takes it, the reference only when creating.
 * An empty JSON field means none; JSON that does not parse is named on its
 * field and nothing is sent.
 */
export function professionPayloadOf(
  draft: ProfessionDraft,
  options: { creating: boolean }
): ProfessionBuilt {
  const errors: FieldErrors = {}
  const parse = (field: 'startingItems' | 'startingResources', empty: unknown) => {
    if (draft[field].trim() === '') {
      return empty
    }

    try {
      return JSON.parse(draft[field]) as unknown
    } catch {
      errors[field] = i18n.t('invalid_json', { ns: 'errors' })
      return undefined
    }
  }
  const startingItems = parse('startingItems', [])
  const startingResources = parse('startingResources', {})

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  return {
    payload: {
      ...(options.creating ? { reference: draft.reference.trim() } : {}),
      labels: labelsOf(draft.labels),
      description: draft.description.trim(),
      skills: draft.skills,
      startingItems,
      startingResources,
    },
  }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
