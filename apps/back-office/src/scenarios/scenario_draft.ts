import { entryDraftOf, entryPayloadOf, type EntryDraft } from '@/content/drafts'
import type { FieldErrors } from '@/content/form_errors'
import {
  type Imported,
  importedEntryOf,
  isImported,
  labelRowsOf,
  listOf,
  phrasesOf,
  textOf,
} from '@/content/imports'
import { labelsOf, rowsOf, type LabelRow } from '@/content/labels'
import i18n from '@/i18n'
import type { Scenario, ScenarioPayload } from './queries'

export type QuestDraft = { key: string; reference: string; step: string; summary: string }

/**
 * A scenario being edited. The pregenerated character, the flags and the
 * events are written as JSON; the initial state is picked from closed lists —
 * a place, a chapter, the quests under way.
 */
export type ScenarioDraft = {
  labels: LabelRow[]
  synopsis: string
  chapters: EntryDraft[]
  quests: EntryDraft[]
  glossary: EntryDraft[]
  /** JSON text; empty for no character yet. */
  pregeneratedCharacter: string
  /** Empty for no initial state yet. */
  startLocation: string
  startChapter: string
  startQuests: QuestDraft[]
  /** The named people the character knows by name from the start. */
  startKnownNpcs: string[]
  /** `HH:MM`, always: a story opens at some time of day. */
  startTime: string
  /** `YYYY-MM-DD`; empty for a story with no date. */
  startDate: string
  /** JSON text: the flags extraction may set. */
  flags: string
  /** JSON text: what happens in the story without the player. */
  events: string
}

/** What a new character looks like, to start from rather than from a blank page. */
export const CHARACTER_TEMPLATE = {
  name: '',
  characteristics: { STR: 10, CON: 10, SIZ: 13, INT: 13, POW: 10, DEX: 10, CHA: 10 },
  skills: {},
  resources: {},
  items: [],
}

export function scenarioDraftOf(scenario: Scenario): ScenarioDraft {
  const state = scenario.initialState

  return {
    labels: rowsOf(scenario.labels),
    synopsis: scenario.synopsis,
    chapters: scenario.chapters.map(entryDraftOf),
    quests: scenario.quests.map(entryDraftOf),
    glossary: scenario.glossary.map(entryDraftOf),
    pregeneratedCharacter:
      scenario.pregeneratedCharacter === null
        ? ''
        : JSON.stringify(scenario.pregeneratedCharacter, null, 2),
    startLocation: state?.location ?? '',
    startChapter: state?.chapter ?? '',
    startQuests: (state?.quests ?? []).map((quest, index) => ({
      key: `${quest.reference}-${index}`,
      reference: quest.reference,
      step: String(quest.step),
      summary: quest.summary,
    })),
    startKnownNpcs: state?.knownNpcs ?? [],
    startTime: scenario.startTime,
    startDate: scenario.startDate ?? '',
    flags: json(scenario.flags ?? []),
    events: json(scenario.events ?? []),
  }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** When a story opens if it says nothing: the default of a scenario created empty. */
const DEFAULT_START_TIME = '08:00'

/**
 * A scenario read from a JSON file, with its reference: a new scenario, every
 * reference still open to change. Its catalogues are not read — they have
 * editors of their own, once the scenario exists.
 */
export function scenarioDraftFromJson(scenario: Imported): {
  reference: string
  draft: ScenarioDraft
} {
  const state = isImported(scenario.initialState) ? scenario.initialState : null
  const character = scenario.pregeneratedCharacter

  return {
    reference: textOf(scenario.reference),
    draft: {
      labels: labelRowsOf(scenario.labels),
      synopsis: textOf(scenario.synopsis),
      chapters: listOf(scenario.chapters, importedEntryOf),
      quests: listOf(scenario.quests, importedEntryOf),
      glossary: listOf(scenario.glossary, importedEntryOf),
      pregeneratedCharacter:
        character === undefined || character === null ? '' : JSON.stringify(character, null, 2),
      startLocation: textOf(state?.location),
      startChapter: textOf(state?.chapter),
      startQuests: listOf(state?.quests, (quest) => ({
        key: crypto.randomUUID(),
        reference: textOf(quest.reference),
        step: typeof quest.step === 'number' ? String(quest.step) : '1',
        summary: textOf(quest.summary),
      })),
      startKnownNpcs: phrasesOf(state?.knownNpcs),
      startTime: textOf(scenario.startTime) || DEFAULT_START_TIME,
      startDate: textOf(scenario.startDate),
      flags: json(Array.isArray(scenario.flags) ? scenario.flags : []),
      events: json(Array.isArray(scenario.events) ? scenario.events : []),
    },
  }
}

export type ScenarioUpdate =
  | { payload: Omit<ScenarioPayload, 'reference'>; errors?: never }
  | { payload?: never; errors: FieldErrors }

/**
 * The edit as the backend takes it. No starting place means no initial
 * state yet; an empty character means none yet — a draft may lack both,
 * publishing will not. JSON that does not parse is named and nothing is sent.
 */
export function scenarioUpdateOf(draft: ScenarioDraft): ScenarioUpdate {
  let character: unknown = null

  if (draft.pregeneratedCharacter.trim() !== '') {
    try {
      character = JSON.parse(draft.pregeneratedCharacter)
    } catch {
      return { errors: { pregeneratedCharacter: i18n.t('invalid_json', { ns: 'errors' }) } }
    }
  }

  const errors: FieldErrors = {}
  const list = (field: 'flags' | 'events') => {
    if (draft[field].trim() === '') {
      return []
    }

    try {
      return JSON.parse(draft[field]) as unknown
    } catch {
      errors[field] = i18n.t('invalid_json', { ns: 'errors' })
      return undefined
    }
  }
  const flags = list('flags')
  const events = list('events')

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  return {
    payload: {
      labels: labelsOf(draft.labels),
      synopsis: draft.synopsis.trim(),
      chapters: draft.chapters.map(entryPayloadOf),
      quests: draft.quests.map(entryPayloadOf),
      glossary: draft.glossary.map(entryPayloadOf),
      pregeneratedCharacter: character,
      initialState:
        draft.startLocation === ''
          ? null
          : {
              location: draft.startLocation,
              chapter: draft.startChapter === '' ? null : draft.startChapter,
              quests: draft.startQuests.map((quest) => ({
                reference: quest.reference,
                step: Number(quest.step),
                summary: quest.summary.trim(),
              })),
              knownNpcs: draft.startKnownNpcs,
            },
      startTime: draft.startTime,
      startDate: draft.startDate === '' ? null : draft.startDate,
      flags,
      events,
    },
  }
}
