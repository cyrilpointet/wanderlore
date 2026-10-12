import { entryDraftOf, entryPayloadOf, type EntryDraft } from '@/content/drafts'
import type { FieldErrors } from '@/content/form_errors'
import { labelsOf, rowsOf, type LabelRow } from '@/content/labels'
import i18n from '@/i18n'
import type { Scenario, ScenarioPayload } from './queries'

export type QuestDraft = { key: string; reference: string; step: string; summary: string }

/**
 * A scenario being edited. The pregenerated character is written as JSON;
 * the initial state is picked from closed lists — a place, a chapter, the
 * quests under way.
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
}

/** What a new character looks like, to start from rather than from a blank page. */
export const CHARACTER_TEMPLATE = {
  name: '',
  attributes: {},
  skills: {},
  hitPointsMax: 10,
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
            },
    },
  }
}
