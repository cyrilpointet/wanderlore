import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FieldError } from './field'
import type { LabelRow } from './labels'
import { ICON_BUTTON, INPUT, SECONDARY } from './ui'

/**
 * The names of something, by language. English comes first and stays: it is
 * required, and the fallback of every other language.
 */
export function LabelsEditor({
  rows,
  onChange,
  error,
  label,
}: {
  rows: LabelRow[]
  onChange: (rows: LabelRow[]) => void
  error?: string
  label?: string
}) {
  const { t } = useTranslation('content')
  const id = useId()

  const update = (index: number, change: Partial<LabelRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...change } : row)))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-label font-medium text-muted">{label ?? t('names')}</legend>
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            aria-label={t('languageCode')}
            value={row.language}
            disabled={index === 0}
            onChange={(event) => update(index, { language: event.target.value })}
            className={`${INPUT} w-16 shrink-0 font-mono`}
          />
          <input
            id={index === 0 ? id : undefined}
            aria-label={t('nameIn', { language: row.language || '…' })}
            value={row.name}
            onChange={(event) => update(index, { name: event.target.value })}
            className={INPUT}
          />
          {index > 0 && (
            <button
              type="button"
              aria-label={t('removeLanguage')}
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
              className={ICON_BUTTON}
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => onChange([...rows, { language: '', name: '' }])}
          className={SECONDARY}
        >
          <Plus aria-hidden className="size-4" />
          {t('addLanguage')}
        </button>
      </div>
      {error && <FieldError message={error} />}
    </fieldset>
  )
}
