import type { EntryDraft } from './drafts'
import { rowsOf, type LabelRow } from './labels'

/**
 * Reading a JSON file into a form. The file is taken as the server sends and
 * takes the content — the shape of `database/content/` too — and nothing in
 * it is trusted: a field of the wrong type is left empty, a key the form does
 * not know is left out. Judging what remains is the server's job, on save.
 */

export type Imported = Record<string, unknown>

export function isImported(value: unknown): value is Imported {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function phrasesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((phrase) => typeof phrase === 'string') : []
}

/** The objects of a list, each turned into a draft; anything else in it is dropped. */
export function listOf<Draft>(value: unknown, draftOf: (entry: Imported) => Draft): Draft[] {
  return Array.isArray(value) ? value.filter(isImported).map(draftOf) : []
}

/** English first, as always, even when the file has none. */
export function labelRowsOf(value: unknown): LabelRow[] {
  const labels = Object.fromEntries(
    Object.entries(isImported(value) ? value : {}).filter(([, name]) => typeof name === 'string')
  ) as Record<string, string>

  return rowsOf({ ...labels, en: labels.en ?? '' })
}

/** An entry not saved yet: its reference may still be changed. */
export function importedEntryOf(entry: Imported): EntryDraft {
  return {
    key: crypto.randomUUID(),
    reference: textOf(entry.reference),
    locked: false,
    labels: labelRowsOf(entry.labels),
  }
}

/** The text of a file, parsed: a single object, or why not. */
export async function readImport(
  file: File
): Promise<{ value: Imported; error?: never } | { value?: never; error: 'invalid_json' | 'not_an_object' }> {
  let value: unknown

  try {
    value = JSON.parse(await file.text())
  } catch {
    return { error: 'invalid_json' }
  }

  return isImported(value) ? { value } : { error: 'not_an_object' }
}

/** The catalogues a world or a scenario file may carry, created with it. */
export const IMPORTED_CATALOGUES = ['locations', 'npcs', 'items', 'lore'] as const
export type ImportedCatalogue = (typeof IMPORTED_CATALOGUES)[number]

/**
 * The entries of each catalogue of a file, as written: the server checks
 * every one of them when the world or the scenario is created, and refuses
 * the whole file on the first fault. Anything that is no object is dropped.
 */
export type ImportedCatalogues = Record<ImportedCatalogue, Imported[]>

export function cataloguesOf(value: Imported): ImportedCatalogues {
  return Object.fromEntries(
    IMPORTED_CATALOGUES.map((catalogue) => [
      catalogue,
      Array.isArray(value[catalogue]) ? value[catalogue].filter(isImported) : [],
    ])
  ) as ImportedCatalogues
}

export function noCatalogues(): ImportedCatalogues {
  return { locations: [], npcs: [], items: [], lore: [] }
}

/**
 * What a world file brings besides the form: its catalogues and lore, its
 * categories of action and its professions — a world ready to play, but for
 * its scenarios.
 */
export type ImportedWorldContent = ImportedCatalogues & {
  actionTypes: Imported[]
  professions: Imported[]
}

export function worldContentOf(value: Imported): ImportedWorldContent {
  return {
    ...cataloguesOf(value),
    actionTypes: objectsOf(value.actionTypes),
    professions: objectsOf(value.professions),
  }
}

export function noWorldContent(): ImportedWorldContent {
  return { ...noCatalogues(), actionTypes: [], professions: [] }
}

function objectsOf(value: unknown): Imported[] {
  return Array.isArray(value) ? value.filter(isImported) : []
}

/** The named entries of a file's catalogue: what the rest of the form may name before it exists. */
export function importedUniques(entries: Imported[]): string[] {
  return entries
    .filter((entry) => entry.kind === 'unique')
    .map((entry) => textOf(entry.reference))
    .filter(Boolean)
}
