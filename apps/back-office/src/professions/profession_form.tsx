import { useTranslation } from 'react-i18next'

import { Field, FieldError } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { LabelsEditor } from '@/content/labels_editor'
import { suggestReference } from '@/content/references'
import { CODE_AREA, INPUT, TEXTAREA } from '@/content/ui'
import type { ProfessionDraft } from './profession_draft'

/** A skill of the world a profession may train: its reference, and its English name. */
export type SkillChoice = { reference: string; name: string }

/**
 * One profession of a world: its names and description, the skills it
 * trains — picked among the world's — and what it starts a game with,
 * written as JSON and checked by the backend field by field.
 */
export function ProfessionForm({
  draft,
  onChange,
  errors,
  idPrefix,
  creating,
  skills,
}: {
  draft: ProfessionDraft
  onChange: (draft: ProfessionDraft) => void
  errors: FieldErrors
  idPrefix: string
  /** The reference is only written once, when the profession is created. */
  creating: boolean
  /** The skills of the world, in its order. */
  skills: SkillChoice[]
}) {
  const { t } = useTranslation('professions')
  const set =
    <Key extends keyof ProfessionDraft>(key: Key) =>
    (value: ProfessionDraft[Key]) =>
      onChange({ ...draft, [key]: value })
  const on = {
    reference: set('reference'),
    labels: set('labels'),
    description: set('description'),
    skills: set('skills'),
    startingItems: set('startingItems'),
    startingResources: set('startingResources'),
  }
  const id = (field: string) => `${idPrefix}-${field}`
  const englishName = draft.labels[0]?.name ?? ''
  const labelsError = errorUnder(errors, 'labels')
  const skillsError = errorUnder(errors, 'skills')
  const itemsError = errorUnder(errors, 'startingItems')
  const resourcesError = errorUnder(errors, 'startingResources')

  return (
    <div className="flex flex-col gap-4">
      <Field
        id={id('reference')}
        label={t('reference', { ns: 'content' })}
        hint={creating ? t('referenceHint', { ns: 'content' }) : undefined}
        error={errors.reference}
      >
        <input
          id={id('reference')}
          value={draft.reference}
          disabled={!creating}
          placeholder={suggestReference(englishName)}
          onChange={(event) => on.reference(event.target.value)}
          onBlur={() => {
            if (creating && draft.reference === '' && englishName !== '') {
              on.reference(suggestReference(englishName))
            }
          }}
          className={`${INPUT} font-mono`}
        />
      </Field>

      <LabelsEditor
        rows={draft.labels}
        onChange={on.labels}
        error={labelsError}
      />

      <Field
        id={id('description')}
        label={t('description')}
        hint={t('descriptionHint')}
        error={errors.description}
      >
        <textarea
          id={id('description')}
          value={draft.description}
          rows={2}
          onChange={(event) => on.description(event.target.value)}
          className={TEXTAREA}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-label font-medium text-muted">{t('skills')}</legend>
        <p className="text-label text-subtle">{t('skillsHint')}</p>
        {skills.length === 0 && draft.skills.length === 0 ? (
          <p className="text-body text-muted">{t('noSkills')}</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {withCurrent(skills, draft.skills).map((skill) => (
              <label key={skill.reference} className="flex items-center gap-2 text-body text-text">
                <input
                  type="checkbox"
                  checked={draft.skills.includes(skill.reference)}
                  onChange={(event) =>
                    on.skills(
                      event.target.checked
                        ? [...draft.skills, skill.reference]
                        : draft.skills.filter((chosen) => chosen !== skill.reference)
                    )
                  }
                  className="size-4 accent-accent"
                />
                <span>{skill.name || skill.reference}</span>
                <span className="font-mono text-label text-subtle">{skill.reference}</span>
              </label>
            ))}
          </div>
        )}
        {skillsError && <FieldError message={skillsError} />}
      </fieldset>

      <Field
        id={id('startingItems')}
        label={t('startingItems')}
        hint={t('startingItemsHint')}
        error={itemsError}
      >
        <textarea
          id={id('startingItems')}
          value={draft.startingItems}
          spellCheck={false}
          placeholder={STARTING_ITEMS_EXAMPLE}
          onChange={(event) => on.startingItems(event.target.value)}
          className={CODE_AREA}
        />
      </Field>

      <Field
        id={id('startingResources')}
        label={t('startingResources')}
        hint={t('startingResourcesHint')}
        error={resourcesError}
      >
        <textarea
          id={id('startingResources')}
          value={draft.startingResources}
          spellCheck={false}
          placeholder={STARTING_RESOURCES_EXAMPLE}
          onChange={(event) => on.startingResources(event.target.value)}
          className={`${CODE_AREA} min-h-24`}
        />
      </Field>
    </div>
  )
}

/** The world's skills, plus those chosen that are no longer among them: the backend names them. */
function withCurrent(skills: SkillChoice[], chosen: string[]): SkillChoice[] {
  const known = new Set(skills.map(({ reference }) => reference))
  const gone = chosen
    .filter((reference) => !known.has(reference))
    .map((reference) => ({ reference, name: '' }))

  return [...gone, ...skills]
}

/** What starting equipment looks like: a soldier's sword, worn. Data, not interface text. */
const STARTING_ITEMS_EXAMPLE = JSON.stringify(
  [{ definition: 'rapier', descriptor: null, quantity: 1, equipped: true }],
  null,
  2
)

/** What starting resources look like. Data, not interface text. */
const STARTING_RESOURCES_EXAMPLE = JSON.stringify({ purse: 10 }, null, 2)
