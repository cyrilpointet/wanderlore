import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { newEntryDraft } from '@/content/drafts'
import { EntryListEditor } from '@/content/entry_list_editor'
import { Field } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { LabelsEditor } from '@/content/labels_editor'
import { PhraseListEditor } from '@/content/phrase_list_editor'
import { INPUT, SECTION, TEXTAREA } from '@/content/ui'
import type { SkillDraft, WorldDraft } from './world_draft'

/**
 * Everything a world holds itself: its names and tone, the rules arbitration
 * reads and the ambiance the narrator reads, the attributes, skills and
 * resources of a character sheet, and its glossary.
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
    attributes: set('attributes'),
    skills: set('skills'),
    resources: set('resources'),
    glossary: set('glossary'),
  }
  const labelsError = errorUnder(errors, 'labels')
  const attributes = draft.attributes.map(({ reference }) => reference).filter(Boolean)

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

          <Section title={t('form.attributes')}>
            <EntryListEditor
              entries={draft.attributes}
              onChange={on.attributes}
              errors={errors}
              path="attributes"
              create={newEntryDraft}
            />
          </Section>

          <Section title={t('form.skills')} hint={t('form.skillsHint')}>
            <EntryListEditor<SkillDraft>
              entries={draft.skills}
              onChange={on.skills}
              errors={errors}
              path="skills"
              create={() => ({ ...newEntryDraft(), attribute: attributes[0] ?? '' })}
              renderExtra={(skill, update, index) => (
                <Field
                  id={`${skill.key}-attribute`}
                  label={t('form.attribute')}
                  error={errors[`skills.${index}.attribute`]}
                >
                  <select
                    id={`${skill.key}-attribute`}
                    value={skill.attribute}
                    onChange={(event) => update({ attribute: event.target.value })}
                    className={INPUT}
                  >
                    {!attributes.includes(skill.attribute) && (
                      <option value={skill.attribute}>{skill.attribute || '—'}</option>
                    )}
                    {attributes.map((reference) => (
                      <option key={reference} value={reference}>
                        {reference}
                      </option>
                    ))}
                  </select>
                </Field>
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
