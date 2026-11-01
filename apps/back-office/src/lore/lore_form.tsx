import { useTranslation } from 'react-i18next'

import { Field } from '@/content/field'
import { errorUnder, type FieldErrors } from '@/content/form_errors'
import { INPUT, TEXTAREA } from '@/content/ui'
import type { LoreDraft } from './lore_draft'
import { LORE_KINDS } from './queries'

/** The group of the tags that name nothing anymore, for its ids. */
const STRAY = 'stray'

/** What a fragment may be tagged with: every place, person and item of its world and scenario. */
export type TagLists = {
  places: string[]
  people: string[]
  items: string[]
}

/**
 * One lore fragment: its kind says which steps read it, its tags when the
 * scene calls for it. A secret is read by arbitration alone.
 */
export function LoreForm({
  draft,
  onChange,
  errors,
  idPrefix,
  creating,
  tags,
}: {
  draft: LoreDraft
  onChange: (draft: LoreDraft) => void
  errors: FieldErrors
  idPrefix: string
  creating: boolean
  tags: TagLists
}) {
  const { t } = useTranslation('lore')
  const set =
    <Key extends keyof LoreDraft>(key: Key) =>
    (value: LoreDraft[Key]) =>
      onChange({ ...draft, [key]: value })
  const id = (field: string) => `${idPrefix}-${field}`
  const ambiance = draft.kind === 'ambiance'
  const tagsError = errorUnder(errors, 'tags')
  const groups = [
    ['places', tags.places],
    ['people', tags.people],
    ['items', tags.items],
  ] as const
  /** A tag that names nothing anymore stays visible, to be unticked. */
  const known = new Set([...tags.places, ...tags.people, ...tags.items])
  const stray = draft.tags.filter((tag) => !known.has(tag))

  const toggle = (tag: string, checked: boolean) =>
    set('tags')(checked ? [...draft.tags, tag] : draft.tags.filter((other) => other !== tag))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('reference')} label={t('reference')} error={errors.reference}>
          <input
            id={id('reference')}
            value={draft.reference}
            disabled={!creating}
            onChange={(event) => set('reference')(event.target.value)}
            className={`${INPUT} font-mono`}
          />
        </Field>
        <Field
          id={id('kind')}
          label={t('kind')}
          hint={t(`kindHints.${draft.kind}`)}
          error={errors.kind}
        >
          <select
            id={id('kind')}
            value={draft.kind}
            onChange={(event) => set('kind')(event.target.value as LoreDraft['kind'])}
            className={INPUT}
          >
            {LORE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id={id('content')} label={t('content')} hint={t('contentHint')} error={errors.content}>
        <textarea
          id={id('content')}
          value={draft.content}
          rows={3}
          onChange={(event) => set('content')(event.target.value)}
          className={TEXTAREA}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-label font-medium text-muted">{t('tags')}</legend>
        <p className="text-label text-subtle">{t('tagsHint')}</p>
        {stray.length > 0 && (
          <TagGroup
            title=""
            tags={stray}
            checked={draft.tags}
            onToggle={toggle}
            idPrefix={id(STRAY)}
          />
        )}
        {groups.map(
          ([group, references]) =>
            references.length > 0 && (
              <TagGroup
                key={group}
                title={t(group)}
                tags={references}
                checked={draft.tags}
                onToggle={toggle}
                idPrefix={id(group)}
              />
            )
        )}
        {tagsError && <p className="text-label text-danger">{tagsError}</p>}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={id('secret')} className="flex items-center gap-2 text-body text-text">
          <input
            id={id('secret')}
            type="checkbox"
            checked={!ambiance && draft.secret}
            disabled={ambiance}
            onChange={(event) => set('secret')(event.target.checked)}
            className="size-4 accent-accent"
          />
          {t('secret')}
        </label>
        {ambiance && <p className="text-label text-subtle">{t('secretAmbiance')}</p>}
        {errors.secret && <p className="text-label text-danger">{errors.secret}</p>}
      </div>
    </div>
  )
}

function TagGroup({
  title,
  tags,
  checked,
  onToggle,
  idPrefix,
}: {
  title: string
  tags: string[]
  checked: string[]
  onToggle: (tag: string, checked: boolean) => void
  idPrefix: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {title && <p className="text-label text-muted">{title}</p>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {tags.map((tag) => (
          <label
            key={tag}
            htmlFor={`${idPrefix}-${tag}`}
            className="flex items-center gap-2 text-body text-text"
          >
            <input
              id={`${idPrefix}-${tag}`}
              type="checkbox"
              checked={checked.includes(tag)}
              onChange={(event) => onToggle(tag, event.target.checked)}
              className="size-4 accent-accent"
            />
            <span className="truncate font-mono text-label">{tag}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
