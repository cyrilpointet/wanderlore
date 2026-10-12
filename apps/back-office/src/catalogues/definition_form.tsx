import { useTranslation } from 'react-i18next'

import { Field } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { LabelsEditor } from '@/content/labels_editor'
import { suggestReference } from '@/content/references'
import { CODE_AREA, INPUT, TEXTAREA } from '@/content/ui'
import type { DefinitionDraft } from './definition_draft'
import { type Catalogue, DISPOSITIONS, KINDS } from './queries'

/** What a definition may name: the unique people and places of its world and scenario. */
export type ClosedLists = {
  uniqueNpcs: string[]
  uniqueLocations: string[]
}

/**
 * One definition of a catalogue: what every definition has, then what its
 * catalogue adds. Fighting profiles and item modifiers are written as JSON,
 * checked by the backend field by field.
 */
export function DefinitionForm({
  catalogue,
  draft,
  onChange,
  errors,
  idPrefix,
  creating,
  lists,
}: {
  catalogue: Catalogue
  draft: DefinitionDraft
  onChange: (draft: DefinitionDraft) => void
  errors: FieldErrors
  idPrefix: string
  creating: boolean
  lists: ClosedLists
}) {
  const { t } = useTranslation('catalogues')
  const set =
    <Key extends keyof DefinitionDraft>(key: Key) =>
    (value: DefinitionDraft[Key]) =>
      onChange({ ...draft, [key]: value })
  const on = {
    reference: set('reference'),
    labels: set('labels'),
    description: set('description'),
    kind: set('kind'),
    generic: set('generic'),
    defaultDisposition: set('defaultDisposition'),
    combat: set('combat'),
    parent: set('parent'),
    stackable: set('stackable'),
    equippable: set('equippable'),
    modifiers: set('modifiers'),
    initialHolder: set('initialHolder'),
  }
  const id = (field: string) => `${idPrefix}-${field}`
  const unique = draft.kind === 'unique'
  const englishName = draft.labels[0]?.name ?? ''
  const labelsError = errorUnder(errors, 'labels')
  const combatError = errorUnder(errors, 'combat')
  const modifiersError = errorUnder(errors, 'modifiers')
  const holderError = errorUnder(errors, 'initialHolder')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('reference')} label={t('reference')} error={errors.reference}>
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
        <Field id={id('kind')} label={t('kind')} hint={t(`kindHint.${catalogue}`)} error={errors.kind}>
          <select
            id={id('kind')}
            value={draft.kind}
            onChange={(event) => on.kind(event.target.value as DefinitionDraft['kind'])}
            className={INPUT}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <LabelsEditor rows={draft.labels} onChange={on.labels} error={labelsError} />

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

      {catalogue !== 'locations' && !unique && (
        <Checkbox
          id={id('generic')}
          label={t(`generic.${catalogue}`)}
          checked={draft.generic}
          onChange={on.generic}
          error={errors.generic}
        />
      )}

      {catalogue === 'npcs' && (
        <>
          <Field
            id={id('disposition')}
            label={t('defaultDisposition')}
            error={errors.defaultDisposition}
          >
            <select
              id={id('disposition')}
              value={draft.defaultDisposition}
              onChange={(event) =>
                on.defaultDisposition(event.target.value as DefinitionDraft['defaultDisposition'])
              }
              className={INPUT}
            >
              {DISPOSITIONS.map((disposition) => (
                <option key={disposition} value={disposition}>
                  {t(`dispositions.${disposition}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={id('combat')} label={t('combat')} hint={t('combatHint')} error={combatError}>
            <textarea
              id={id('combat')}
              value={draft.combat}
              spellCheck={false}
              onChange={(event) => on.combat(event.target.value)}
              className={CODE_AREA}
            />
          </Field>
        </>
      )}

      {catalogue === 'locations' && unique && (
        <Field id={id('parent')} label={t('parent')} hint={t('parentHint')} error={errors.parent}>
          <select
            id={id('parent')}
            value={draft.parent}
            onChange={(event) => on.parent(event.target.value)}
            className={INPUT}
          >
            <option value="">{t('none')}</option>
            {lists.uniqueLocations
              .filter((reference) => reference !== draft.reference)
              .map((reference) => (
                <option key={reference} value={reference}>
                  {reference}
                </option>
              ))}
          </select>
        </Field>
      )}

      {catalogue === 'items' && (
        <>
          {!unique && (
            <Checkbox
              id={id('stackable')}
              label={t('stackable')}
              checked={draft.stackable}
              onChange={on.stackable}
              error={errors.stackable}
            />
          )}
          <Checkbox
            id={id('equippable')}
            label={t('equippable')}
            checked={draft.equippable}
            onChange={on.equippable}
            error={errors.equippable}
          />
          {unique && (
            <Field
              id={id('holder')}
              label={t('initialHolder')}
              hint={t('initialHolderHint')}
              error={holderError}
            >
              <select
                id={id('holder')}
                value={draft.initialHolder}
                onChange={(event) => on.initialHolder(event.target.value)}
                className={INPUT}
              >
                <option value="">{t('none')}</option>
                <optgroup label={t('people')}>
                  {lists.uniqueNpcs.map((reference) => (
                    <option key={reference} value={`npc:${reference}`}>
                      {reference}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('places')}>
                  {lists.uniqueLocations.map((reference) => (
                    <option key={reference} value={`location:${reference}`}>
                      {reference}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
          )}
          <Field
            id={id('modifiers')}
            label={t('modifiers')}
            hint={t('modifiersHint')}
            error={modifiersError}
          >
            <textarea
              id={id('modifiers')}
              value={draft.modifiers}
              spellCheck={false}
              onChange={(event) => on.modifiers(event.target.value)}
              className={CODE_AREA}
            />
          </Field>
        </>
      )}
    </div>
  )
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
  error,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2 text-body text-text">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-accent"
        />
        {label}
      </label>
      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  )
}
