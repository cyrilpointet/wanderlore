import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { newEntryDraft } from '@/content/drafts'
import { EntryListEditor } from '@/content/entry_list_editor'
import { Field } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { LabelsEditor } from '@/content/labels_editor'
import { CODE_AREA, ICON_BUTTON, INPUT, SECONDARY, SECTION, TEXTAREA } from '@/content/ui'
import { CHARACTER_TEMPLATE, type QuestDraft, type ScenarioDraft } from './scenario_draft'

/**
 * A scenario's story: its names and synopsis, chapters and quests, the
 * character it is played with, and where a game of it starts.
 */
export function ScenarioForm({
  reference,
  draft,
  onChange,
  errors,
  uniqueLocations,
}: {
  reference: string
  draft: ScenarioDraft
  onChange: (draft: ScenarioDraft) => void
  errors: FieldErrors
  /** The named places of the world and the scenario: where a game may start. */
  uniqueLocations: string[]
}) {
  const { t } = useTranslation('scenarios')
  const set =
    <Key extends keyof ScenarioDraft>(key: Key) =>
    (value: ScenarioDraft[Key]) =>
      onChange({ ...draft, [key]: value })
  const on = {
    labels: set('labels'),
    synopsis: set('synopsis'),
    chapters: set('chapters'),
    quests: set('quests'),
    glossary: set('glossary'),
    pregeneratedCharacter: set('pregeneratedCharacter'),
    startLocation: set('startLocation'),
    startChapter: set('startChapter'),
    startQuests: set('startQuests'),
  }
  const labelsError = errorUnder(errors, 'labels')
  const characterError = errorUnder(errors, 'pregeneratedCharacter')
  const chapters = draft.chapters.map(({ reference: chapter }) => chapter).filter(Boolean)
  const quests = draft.quests.map(({ reference: quest }) => quest).filter(Boolean)

  const updateQuest = (index: number, change: Partial<QuestDraft>) =>
    on.startQuests(
      draft.startQuests.map((quest, at) => (at === index ? { ...quest, ...change } : quest))
    )

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('form.identity')}>
        <Field id="scenario-reference" label={t('form.reference')}>
          <input
            id="scenario-reference"
            value={reference}
            disabled
            className={`${INPUT} font-mono`}
          />
        </Field>
        <LabelsEditor
          rows={draft.labels}
          onChange={on.labels}
          error={labelsError}
          label={t('form.title')}
        />
        <Field
          id="scenario-synopsis"
          label={t('form.synopsis')}
          hint={t('form.synopsisHint')}
          error={errors.synopsis}
        >
          <textarea
            id="scenario-synopsis"
            value={draft.synopsis}
            rows={4}
            onChange={(event) => on.synopsis(event.target.value)}
            className={TEXTAREA}
          />
        </Field>
      </Section>

      <Section title={t('form.chapters')}>
        <EntryListEditor
          entries={draft.chapters}
          onChange={on.chapters}
          errors={errors}
          path="chapters"
          create={newEntryDraft}
        />
      </Section>

      <Section title={t('form.quests')}>
        <EntryListEditor
          entries={draft.quests}
          onChange={on.quests}
          errors={errors}
          path="quests"
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

      <Section title={t('form.character')} hint={t('form.characterHint')}>
        <Field id="scenario-character" label={t('form.characterJson')} error={characterError}>
          <textarea
            id="scenario-character"
            value={draft.pregeneratedCharacter}
            spellCheck={false}
            onChange={(event) => on.pregeneratedCharacter(event.target.value)}
            className={`${CODE_AREA} min-h-72`}
          />
        </Field>
        {draft.pregeneratedCharacter.trim() === '' && (
          <div>
            <button
              type="button"
              onClick={() => on.pregeneratedCharacter(JSON.stringify(CHARACTER_TEMPLATE, null, 2))}
              className={SECONDARY}
            >
              {t('form.characterTemplate')}
            </button>
          </div>
        )}
      </Section>

      <Section title={t('form.start')} hint={t('form.startHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="scenario-start-location"
            label={t('form.startLocation')}
            error={errors['initialState.location']}
          >
            <select
              id="scenario-start-location"
              value={draft.startLocation}
              onChange={(event) => on.startLocation(event.target.value)}
              className={INPUT}
            >
              <option value="">{t('form.noStart')}</option>
              {withCurrent(uniqueLocations, draft.startLocation).map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="scenario-start-chapter"
            label={t('form.startChapter')}
            error={errors['initialState.chapter']}
          >
            <select
              id="scenario-start-chapter"
              value={draft.startChapter}
              disabled={draft.startLocation === ''}
              onChange={(event) => on.startChapter(event.target.value)}
              className={INPUT}
            >
              <option value="">{t('form.noChapter')}</option>
              {withCurrent(chapters, draft.startChapter).map((chapter) => (
                <option key={chapter} value={chapter}>
                  {chapter}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {draft.startLocation !== '' && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-label font-medium text-muted">
              {t('form.startQuests')}
            </legend>
            {draft.startQuests.map((quest, index) => (
              <div key={quest.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_6rem]">
                    <select
                      aria-label={t('form.quest')}
                      value={quest.reference}
                      onChange={(event) => updateQuest(index, { reference: event.target.value })}
                      className={INPUT}
                    >
                      {withCurrent(quests, quest.reference).map((reference) => (
                        <option key={reference} value={reference}>
                          {reference}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={t('form.questStep')}
                      type="number"
                      min={1}
                      value={quest.step}
                      onChange={(event) => updateQuest(index, { step: event.target.value })}
                      className={INPUT}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={t('form.removeQuest')}
                    onClick={() =>
                      on.startQuests(draft.startQuests.filter((_, at) => at !== index))
                    }
                    className={ICON_BUTTON}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                <textarea
                  aria-label={t('form.questSummary')}
                  value={quest.summary}
                  rows={2}
                  placeholder={t('form.questSummaryHint')}
                  onChange={(event) => updateQuest(index, { summary: event.target.value })}
                  className={TEXTAREA}
                />
                {errorUnder(errors, `initialState.quests.${index}`) && (
                  <p className="text-label text-danger">
                    {errorUnder(errors, `initialState.quests.${index}`)}
                  </p>
                )}
              </div>
            ))}
            <div>
              <button
                type="button"
                disabled={quests.length === 0}
                onClick={() =>
                  on.startQuests([
                    ...draft.startQuests,
                    { key: crypto.randomUUID(), reference: quests[0] ?? '', step: '1', summary: '' },
                  ])
                }
                className={SECONDARY}
              >
                <Plus aria-hidden className="size-4" />
                {t('form.addQuest')}
              </button>
            </div>
          </fieldset>
        )}
      </Section>
    </div>
  )
}

/** The choices, plus the current value when it is not among them anymore. */
function withCurrent(choices: string[], current: string): string[] {
  return current === '' || choices.includes(current) ? choices : [current, ...choices]
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
