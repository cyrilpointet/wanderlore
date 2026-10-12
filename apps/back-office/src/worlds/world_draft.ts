import { entryDraftOf, entryPayloadOf, type EntryDraft } from '@/content/drafts'
import { labelsOf, rowsOf, type LabelRow } from '@/content/labels'
import type { WorldDetail, WorldPayload } from './queries'

export type SkillDraft = EntryDraft & { attribute: string }

/** A world being edited, as the form holds it. */
export type WorldDraft = {
  reference: string
  labels: LabelRow[]
  narrativeTone: string
  rules: string[]
  ambiance: string[]
  attributes: EntryDraft[]
  skills: SkillDraft[]
  resources: EntryDraft[]
  glossary: EntryDraft[]
}

/** A new world: an English name and a tone to start from, the rest added afterwards. */
export function emptyWorldDraft(): WorldDraft {
  return {
    reference: '',
    labels: [{ language: 'en', name: '' }],
    narrativeTone: '',
    rules: [],
    ambiance: [],
    attributes: [],
    skills: [],
    resources: [],
    glossary: [],
  }
}

export function worldDraftOf(world: WorldDetail): WorldDraft {
  return {
    reference: world.reference,
    labels: rowsOf(world.labels),
    narrativeTone: world.narrativeTone,
    rules: world.rules,
    ambiance: world.ambiance,
    attributes: world.attributes.map(entryDraftOf),
    skills: world.skills.map((skill) => ({ ...entryDraftOf(skill), attribute: skill.attribute })),
    resources: world.resources.map(entryDraftOf),
    glossary: world.glossary.map(entryDraftOf),
  }
}

/**
 * The world as the backend takes it. Phrases are trimmed and blank ones
 * dropped; everything else is sent as written, for the backend to judge.
 */
export function worldPayloadOf(draft: WorldDraft): WorldPayload {
  const phrases = (list: string[]) => list.map((phrase) => phrase.trim()).filter(Boolean)

  return {
    reference: draft.reference.trim(),
    labels: labelsOf(draft.labels),
    narrativeTone: draft.narrativeTone.trim(),
    rules: phrases(draft.rules),
    ambiance: phrases(draft.ambiance),
    attributes: draft.attributes.map(entryPayloadOf),
    skills: draft.skills.map((skill) => ({
      ...entryPayloadOf(skill),
      attribute: skill.attribute,
    })),
    resources: draft.resources.map(entryPayloadOf),
    glossary: draft.glossary.map(entryPayloadOf),
  }
}

/** An edit of a saved world: everything but the reference, which never changes. */
export function worldUpdateOf(draft: WorldDraft): Omit<WorldPayload, 'reference'> {
  const payload: Partial<WorldPayload> = worldPayloadOf(draft)
  delete payload.reference

  return payload as Omit<WorldPayload, 'reference'>
}
