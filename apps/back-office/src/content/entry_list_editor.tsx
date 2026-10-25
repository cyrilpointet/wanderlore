import type { ReactNode } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FieldError } from './field'
import { errorUnder, type FieldErrors } from './form_errors'
import type { EntryDraft } from './drafts'
import { LabelsEditor } from './labels_editor'
import { suggestReference } from './references'
import { DANGER, INPUT, SECONDARY } from './ui'

/**
 * A list of entries — skills, resources, chapters… — each with its
 * reference, its names, and whatever else `renderExtra` adds.
 */
export function EntryListEditor<Draft extends EntryDraft>({
  entries,
  onChange,
  errors,
  path,
  create,
  renderExtra,
}: {
  entries: Draft[]
  onChange: (entries: Draft[]) => void
  errors: FieldErrors
  /** The field the list is sent as (`skills`), for its errors. */
  path: string
  create: () => Draft
  renderExtra?: (entry: Draft, update: (change: Partial<Draft>) => void, index: number) => ReactNode
}) {
  const { t } = useTranslation('content')

  const update = (index: number, change: Partial<Draft>) =>
    onChange(entries.map((entry, at) => (at === index ? { ...entry, ...change } : entry)))

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, index) => {
        const prefix = `${path}.${index}`
        const englishName = entry.labels[0]?.name ?? ''

        return (
          <div key={entry.key} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${entry.key}-reference`} className="text-label font-medium text-muted">
                {t('reference')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${entry.key}-reference`}
                  value={entry.reference}
                  disabled={entry.locked}
                  placeholder={suggestReference(englishName)}
                  onChange={(event) => update(index, { reference: event.target.value } as Partial<Draft>)}
                  onBlur={() => {
                    if (!entry.locked && entry.reference === '' && englishName !== '') {
                      update(index, { reference: suggestReference(englishName) } as Partial<Draft>)
                    }
                  }}
                  className={`${INPUT} font-mono`}
                />
                {entry.locked && (
                  <Lock aria-label={t('referenceLocked')} className="size-4 shrink-0 text-subtle" />
                )}
              </div>
              {errors[`${prefix}.reference`] && <FieldError message={errors[`${prefix}.reference`]!} />}
            </div>

            <LabelsEditor
              rows={entry.labels}
              onChange={(labels) => update(index, { labels } as Partial<Draft>)}
              error={errorUnder(errors, `${prefix}.labels`)}
            />

            {renderExtra?.(entry, (change) => update(index, change), index)}

            <div>
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, at) => at !== index))}
                className={DANGER}
              >
                <Trash2 aria-hidden className="size-4" />
                {t('removeEntry')}
              </button>
            </div>
          </div>
        )
      })}
      <div>
        <button type="button" onClick={() => onChange([...entries, create()])} className={SECONDARY}>
          <Plus aria-hidden className="size-4" />
          {t('addEntry')}
        </button>
      </div>
      {errors[path] && <FieldError message={errors[path]} />}
    </div>
  )
}
