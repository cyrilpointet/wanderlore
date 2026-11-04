import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { newEntryDraft } from '@/content/drafts'
import { EntryListEditor } from '@/content/entry_list_editor'
import { Field } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { LabelsEditor } from '@/content/labels_editor'
import { CODE_AREA, ICON_BUTTON, INPUT, SECONDARY, SECTION, TEXTAREA } from '@/content/ui'
import type { QuestDraft, ScenarioDraft } from './scenario_draft'

/**
 * A scenario's story: its names and synopsis, chapters and quests, what every
 * character starts it with, and where a game of it starts.
 */
export function ScenarioForm({
  reference,
  onReferenceChange,
  draft,
  onChange,
  errors,
  uniqueLocations,
  uniqueNpcs,
}: {
  reference: string
  /** Only for a scenario not created yet: the reference never changes afterwards. */
  onReferenceChange?: (reference: string) => void
  draft: ScenarioDraft
  onChange: (draft: ScenarioDraft) => void
  errors: FieldErrors
  /** The named places of the world and the scenario: where a game may start. */
  uniqueLocations: string[]
  /** The named people of the world and the scenario: whose names the character may know. */
  uniqueNpcs: string[]
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
    kitItems: set('kitItems'),
    kitResources: set('kitResources'),
    startLocation: set('startLocation'),
    startChapter: set('startChapter'),
    startQuests: set('startQuests'),
    startKnownNpcs: set('startKnownNpcs'),
    startTime: set('startTime'),
    startDate: set('startDate'),
    flags: set('flags'),
    events: set('events'),
  }
  const labelsError = errorUnder(errors, 'labels')
  const kitItemsError = errorUnder(errors, 'startingKit.items')
  const kitResourcesError = errorUnder(errors, 'startingKit.resources')
  const knownNpcsError = errorUnder(errors, 'initialState.knownNpcs')
  const flagsError = errorUnder(errors, 'flags')
  const eventsError = errorUnder(errors, 'events')
  const chapters = draft.chapters.map(({ reference: chapter }) => chapter).filter(Boolean)
  const quests = draft.quests.map(({ reference: quest }) => quest).filter(Boolean)

  const updateQuest = (index: number, change: Partial<QuestDraft>) =>
    on.startQuests(
      draft.startQuests.map((quest, at) => (at === index ? { ...quest, ...change } : quest))
    )

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('form.identity')}>
        <Field
          id="scenario-reference"
          label={t('form.reference')}
          hint={onReferenceChange && t('referenceHint', { ns: 'content' })}
          error={errors.reference}
        >
          <input
            id="scenario-reference"
            value={reference}
            disabled={!onReferenceChange}
            onChange={(event) => onReferenceChange?.(event.target.value)}
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

      <Section title={t('form.startingKit')} hint={t('form.startingKitHint')}>
        <Field
          id="scenario-kit-items"
          label={t('form.kitItems')}
          hint={t('form.kitItemsHint')}
          error={kitItemsError}
        >
          <textarea
            id="scenario-kit-items"
            value={draft.kitItems}
            spellCheck={false}
            placeholder={KIT_ITEMS_EXAMPLE}
            onChange={(event) => on.kitItems(event.target.value)}
            className={CODE_AREA}
          />
        </Field>
        <Field
          id="scenario-kit-resources"
          label={t('form.kitResources')}
          hint={t('form.kitResourcesHint')}
          error={kitResourcesError}
        >
          <textarea
            id="scenario-kit-resources"
            value={draft.kitResources}
            spellCheck={false}
            placeholder={KIT_RESOURCES_EXAMPLE}
            onChange={(event) => on.kitResources(event.target.value)}
            className={`${CODE_AREA} min-h-24`}
          />
        </Field>
      </Section>

      <Section title={t('form.flags')} hint={t('form.flagsHint')}>
        <Field id="scenario-flags" label={t('form.flagsJson')} error={flagsError}>
          <textarea
            id="scenario-flags"
            value={draft.flags}
            spellCheck={false}
            placeholder={FLAGS_EXAMPLE}
            onChange={(event) => on.flags(event.target.value)}
            className={CODE_AREA}
          />
        </Field>
      </Section>

      <Section title={t('form.events')} hint={t('form.eventsHint')}>
        <Field id="scenario-events" label={t('form.eventsJson')} error={eventsError}>
          <textarea
            id="scenario-events"
            value={draft.events}
            spellCheck={false}
            placeholder={EVENTS_EXAMPLE}
            onChange={(event) => on.events(event.target.value)}
            className={`${CODE_AREA} min-h-72`}
          />
        </Field>
      </Section>

      <Section title={t('form.start')} hint={t('form.startHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="scenario-start-time"
            label={t('form.startTime')}
            hint={t('form.startTimeHint')}
            error={errors.startTime}
          >
            <input
              id="scenario-start-time"
              type="time"
              required
              value={draft.startTime}
              onChange={(event) => on.startTime(event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field
            id="scenario-start-date"
            label={t('form.startDate')}
            hint={t('form.startDateHint')}
            error={errors.startDate}
          >
            <input
              id="scenario-start-date"
              type="date"
              value={draft.startDate}
              onChange={(event) => on.startDate(event.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
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

        {draft.startLocation !== '' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label font-medium text-muted">
              {t('form.knownNpcs')}
            </legend>
            <p className="text-label text-subtle">{t('form.knownNpcsHint')}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {withCurrentAll(uniqueNpcs, draft.startKnownNpcs).map((npc) => (
                <label key={npc} className="flex items-center gap-2 text-body text-text">
                  <input
                    type="checkbox"
                    checked={draft.startKnownNpcs.includes(npc)}
                    onChange={(event) =>
                      on.startKnownNpcs(
                        event.target.checked
                          ? [...draft.startKnownNpcs, npc]
                          : draft.startKnownNpcs.filter((known) => known !== npc)
                      )
                    }
                  />
                  <span className="font-mono">{npc}</span>
                </label>
              ))}
            </div>
            {knownNpcsError && <p className="text-label text-danger">{knownNpcsError}</p>}
          </fieldset>
        )}
      </Section>
    </div>
  )
}

/** The choices, plus the values chosen that are not among them anymore. */
function withCurrentAll(choices: string[], current: string[]): string[] {
  return [...current.filter((value) => !choices.includes(value)), ...choices]
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

/** What a starting kit's items look like: a letter to deliver. Data, not interface text. */
const KIT_ITEMS_EXAMPLE = JSON.stringify(
  [
    {
      definition: 'letter_of_introduction',
      descriptor: 'sealed with red wax',
      quantity: 1,
      equipped: false,
    },
  ],
  null,
  2
)

/** What a starting kit's resources look like. Data, not interface text. */
const KIT_RESOURCES_EXAMPLE = JSON.stringify({ purse: 5 }, null, 2)

/** What a flag looks like. Data, not interface text. */
const FLAGS_EXAMPLE = JSON.stringify(
  [{ reference: 'egg_stolen', description: "The dragon's egg has been taken from its nest." }],
  null,
  2
)

/** What an event looks like: a deadline the elves may be warned of. Data, not interface text. */
const EVENTS_EXAMPLE = JSON.stringify(
  [
    {
      reference: 'goblins_attack',
      when: { at: { day: 3, period: 'night', time: null }, conditions: [], delay: null },
      unless: [{ type: 'flag', flag: 'elves_warned' }],
      place: 'elf_camp',
      description: 'Goblins pour out of the woods and fall upon the camp.',
      effects: [
        { type: 'npc_entered', npc: 'goblin', location: 'elf_camp', descriptor: null },
        { type: 'flag_set', flag: 'camp_attacked' },
      ],
      interrupts: true,
      foreseeable: null,
    },
  ],
  null,
  2
)
