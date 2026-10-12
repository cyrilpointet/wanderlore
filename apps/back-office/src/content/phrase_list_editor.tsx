import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FieldError } from './field'
import type { FieldErrors } from './form_errors'
import { ICON_BUTTON, SECONDARY, TEXTAREA } from './ui'

/** A list of English phrases — rules for arbitration, ambiance for the narrator. */
export function PhraseListEditor({
  phrases,
  onChange,
  errors,
  path,
}: {
  phrases: string[]
  onChange: (phrases: string[]) => void
  errors: FieldErrors
  /** The field the list is sent as (`rules`), for its errors. */
  path: string
}) {
  const { t } = useTranslation('content')

  return (
    <div className="flex flex-col gap-2">
      {phrases.map((phrase, index) => (
        <div key={index} className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <textarea
              aria-label={t('phrase', { number: index + 1 })}
              value={phrase}
              rows={2}
              onChange={(event) =>
                onChange(phrases.map((value, at) => (at === index ? event.target.value : value)))
              }
              className={TEXTAREA}
            />
            <button
              type="button"
              aria-label={t('remove')}
              onClick={() => onChange(phrases.filter((_, at) => at !== index))}
              className={ICON_BUTTON}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {errors[`${path}.${index}`] && <FieldError message={errors[`${path}.${index}`]!} />}
        </div>
      ))}
      <div>
        <button type="button" onClick={() => onChange([...phrases, ''])} className={SECONDARY}>
          <Plus aria-hidden className="size-4" />
          {t('addPhrase')}
        </button>
      </div>
      {errors[path] && <FieldError message={errors[path]} />}
    </div>
  )
}
