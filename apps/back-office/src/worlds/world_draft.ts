import { entryDraftOf, entryPayloadOf, newEntryDraft, type EntryDraft } from '@/content/drafts'
import {
  type Imported,
  importedEntryOf,
  isImported,
  labelRowsOf,
  listOf,
  textOf,
} from '@/content/imports'
import { labelsOf, rowsOf, type LabelRow } from '@/content/labels'
import {
  CHARACTERISTICS,
  type Characteristic,
  POWER_LEVELS,
  type PowerLevel,
  type Skill,
  SKILL_CATEGORIES,
  type SkillCategory,
  type WorldDetail,
  type WorldPayload,
} from './queries'

/**
 * A skill being edited. Its base chance is held as typed: a fixed chance, or
 * a characteristic and a multiplier when `baseCharacteristic` is set.
 */
export type SkillDraft = EntryDraft & {
  category: SkillCategory
  baseCharacteristic: Characteristic | ''
  /** The fixed chance, or the multiplier of the characteristic. */
  baseValue: string
}

/** A world being edited, as the form holds it. */
export type WorldDraft = {
  reference: string
  labels: LabelRow[]
  narrativeTone: string
  powerLevel: PowerLevel
  skills: SkillDraft[]
  resources: EntryDraft[]
  glossary: EntryDraft[]
}

/** The level of a world that says none: the book's ordinary people. */
const DEFAULT_POWER_LEVEL: PowerLevel = 'normal'

/** A new world: an English name and a tone to start from, the rest added afterwards. */
export function emptyWorldDraft(): WorldDraft {
  return {
    reference: '',
    labels: [{ language: 'en', name: '' }],
    narrativeTone: '',
    powerLevel: DEFAULT_POWER_LEVEL,
    skills: [],
    resources: [],
    glossary: [],
  }
}

/** A new skill: physical, at the 5% most skills of the book start from. */
export function newSkillDraft(): SkillDraft {
  return { ...newEntryDraft(), category: 'physical', baseCharacteristic: '', baseValue: '5' }
}

export function skillDraftOf(skill: Skill): SkillDraft {
  const base = skill.baseChance

  return {
    ...entryDraftOf(skill),
    category: skill.category,
    baseCharacteristic: typeof base === 'number' ? '' : base.characteristic,
    baseValue: String(typeof base === 'number' ? base : base.multiplier),
  }
}

export function worldDraftOf(world: WorldDetail): WorldDraft {
  return {
    reference: world.reference,
    labels: rowsOf(world.labels),
    narrativeTone: world.narrativeTone,
    powerLevel: world.powerLevel,
    skills: world.skills.map(skillDraftOf),
    resources: world.resources.map(entryDraftOf),
    glossary: world.glossary.map(entryDraftOf),
  }
}

/**
 * A world read from a JSON file, as a new world: every reference may still
 * be changed. A skill of an unknown category or base chance keeps the
 * default of a new one; an unknown power level, the normal one. The
 * professions of the file are not read here: they are created with the world
 * as they are written, like its catalogues.
 */
export function worldDraftFromJson(world: Imported): WorldDraft {
  return {
    reference: textOf(world.reference),
    labels: labelRowsOf(world.labels),
    narrativeTone: textOf(world.narrativeTone),
    powerLevel: POWER_LEVELS.find((known) => known === world.powerLevel) ?? DEFAULT_POWER_LEVEL,
    skills: listOf(world.skills, importedSkillOf),
    resources: listOf(world.resources, importedEntryOf),
    glossary: listOf(world.glossary, importedEntryOf),
  }
}

function importedSkillOf(skill: Imported): SkillDraft {
  const base = skill.baseChance
  const category = SKILL_CATEGORIES.find((known) => known === skill.category)
  const characteristic = isImported(base)
    ? CHARACTERISTICS.find((known) => known === base.characteristic)
    : undefined
  const draft: SkillDraft = { ...newSkillDraft(), ...importedEntryOf(skill) }

  if (category) draft.category = category
  if (typeof base === 'number') draft.baseValue = String(base)
  if (characteristic && isImported(base) && typeof base.multiplier === 'number') {
    draft.baseCharacteristic = characteristic
    draft.baseValue = String(base.multiplier)
  }

  return draft
}

/** The world as the backend takes it: sent as written, for the backend to judge. */
export function worldPayloadOf(draft: WorldDraft): WorldPayload {
  return {
    reference: draft.reference.trim(),
    labels: labelsOf(draft.labels),
    narrativeTone: draft.narrativeTone.trim(),
    powerLevel: draft.powerLevel,
    skills: draft.skills.map((skill) => ({
      ...entryPayloadOf(skill),
      category: skill.category,
      baseChance:
        skill.baseCharacteristic === ''
          ? Number(skill.baseValue)
          : { characteristic: skill.baseCharacteristic, multiplier: Number(skill.baseValue) },
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
