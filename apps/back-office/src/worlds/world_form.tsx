import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { newEntryDraft } from '@/content/drafts'
import { EntryListEditor } from '@/content/entry_list_editor'
import { Field } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { LabelsEditor } from '@/content/labels_editor'
import { PhraseListEditor } from '@/content/phrase_list_editor'
import { INPUT, SECTION, TEXTAREA } from '@/content/ui'
import { CHARACTERISTICS, SKILL_CATEGORIES, type Characteristic, type SkillCategory } from './queries'
import { newSkillDraft, type SkillDraft, type WorldDraft } from './world_draft'

/**
 * Everything a world holds itself: its names and tone, the rules arbitration
 * reads and the ambiance the narrator reads, the skills and resources of a
 * character sheet, and its glossary. The characteristics are BRP's, the same
 * in every world: there is nothing to edit about them.
 */
export function WorldForm({
  draft,
  onChange,
  errors,
  creating,
}: {
  draft: WorldDraft
  onChange: (draft: WorldDraft) => void
  errors: FieldErrors
  /** The reference is only written once, when the world is created. */
  creating: boolean
}) {
  const { t } = useTranslation('worlds')
  const set =
    <Key extends keyof WorldDraft>(key: Key) =>
    (value: WorldDraft[Key]) =>
      onChange({ ...draft, [key]: value })
  const on = {
    reference: set('reference'),
    labels: set('labels'),
    narrativeTone: set('narrativeTone'),
    rules: set('rules'),
    ambiance: set('ambiance'),
    skills: set('skills'),
    resources: set('resources'),
    glossary: set('glossary'),
  }
  const labelsError = errorUnder(errors, 'labels')

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('form.general')}>
        <Field
          id="world-reference"
          label={t('form.reference')}
          hint={t('form.referenceHint')}
          error={errors.reference}
        >
          <input
            id="world-reference"
            value={draft.reference}
            disabled={!creating}
            onChange={(event) => on.reference(event.target.value)}
            className={`${INPUT} font-mono`}
          />
        </Field>
        <LabelsEditor
          rows={draft.labels}
          onChange={on.labels}
          error={labelsError}
        />
        <Field
          id="world-tone"
          label={t('form.tone')}
          hint={t('form.toneHint')}
          error={errors.narrativeTone}
        >
          <textarea
            id="world-tone"
            value={draft.narrativeTone}
            rows={2}
            onChange={(event) => on.narrativeTone(event.target.value)}
            className={TEXTAREA}
          />
        </Field>
      </Section>

      {!creating && (
        <>
          <Section title={t('form.rules')} hint={t('form.rulesHint')}>
            <PhraseListEditor
              phrases={draft.rules}
              onChange={on.rules}
              errors={errors}
              path="rules"
            />
          </Section>

          <Section title={t('form.ambiance')} hint={t('form.ambianceHint')}>
            <PhraseListEditor
              phrases={draft.ambiance}
              onChange={on.ambiance}
              errors={errors}
              path="ambiance"
            />
          </Section>

          <Section title={t('form.skills')} hint={t('form.skillsHint')}>
            <EntryListEditor<SkillDraft>
              entries={draft.skills}
              onChange={on.skills}
              errors={errors}
              path="skills"
              create={newSkillDraft}
              renderExtra={(skill, update, index) => (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    id={`${skill.key}-category`}
                    label={t('form.category')}
                    error={errors[`skills.${index}.category`]}
                  >
                    <select
                      id={`${skill.key}-category`}
                      value={skill.category}
                      onChange={(event) =>
                        update({ category: event.target.value as SkillCategory })
                      }
                      className={INPUT}
                    >
                      {SKILL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {t(`categories.${category}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id={`${skill.key}-base-from`}
                    label={t('form.baseFrom')}
                    error={errorUnder(errors, `skills.${index}.baseChance`)}
                  >
                    <select
                      id={`${skill.key}-base-from`}
                      value={skill.baseCharacteristic}
                      onChange={(event) =>
                        update({ baseCharacteristic: event.target.value as Characteristic | '' })
                      }
                      className={INPUT}
                    >
                      <option value="">{t('form.baseFixed')}</option>
                      {CHARACTERISTICS.map((characteristic) => (
                        <option key={characteristic} value={characteristic}>
                          {t(`characteristics.${characteristic}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id={`${skill.key}-base-value`}
                    label={
                      skill.baseCharacteristic === ''
                        ? t('form.baseChance')
                        : t('form.baseMultiplier')
                    }
                  >
                    <input
                      id={`${skill.key}-base-value`}
                      type="number"
                      inputMode="numeric"
                      value={skill.baseValue}
                      onChange={(event) => update({ baseValue: event.target.value })}
                      className={INPUT}
                    />
                  </Field>
                </div>
              )}
            />
          </Section>

          <Section title={t('form.resources')}>
            <EntryListEditor
              entries={draft.resources}
              onChange={on.resources}
              errors={errors}
              path="resources"
              create={newEntryDraft}
            />
          </Section>

          <Section title={t('form.glossary')} hint={t('form.glossaryHint')}>
            <EntryListEditor
              entries={draft.glossary}
              onChange={on.glossary}
              errors={errors}
              path="glossary"
              create={newEntryDraft}
            />
          </Section>
        </>
      )}
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className={`${SECTION} flex flex-col gap-4`}>
      <header>
        <h2 className="font-serif text-[1.25rem] text-text">{title}</h2>
        {hint && <p className="mt-1 text-label text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  )
}
