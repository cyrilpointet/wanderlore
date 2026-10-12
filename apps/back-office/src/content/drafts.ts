import { labelsOf, rowsOf, type LabelRow, type Labels } from './labels'

/**
 * An entry of a list being edited: a reference and its names. `locked` once
 * it was saved: a reference never changes afterwards.
 */
export type EntryDraft = {
  key: string
  reference: string
  locked: boolean
  labels: LabelRow[]
}

export function newEntryDraft(): EntryDraft {
  return {
    key: crypto.randomUUID(),
    reference: '',
    locked: false,
    labels: [{ language: 'en', name: '' }],
  }
}

/** A saved entry, as it comes from the backend: its reference is locked. */
export function entryDraftOf(entry: { reference: string; labels: Labels }): EntryDraft {
  return { key: entry.reference, reference: entry.reference, locked: true, labels: rowsOf(entry.labels) }
}

/** An entry as the backend takes it. */
export function entryPayloadOf(draft: EntryDraft): { reference: string; labels: Labels } {
  return { reference: draft.reference.trim(), labels: labelsOf(draft.labels) }
}
