import { useState, type ChangeEvent } from 'react'
import { FileUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FieldError } from './field'
import { readImport, type Imported } from './imports'
import { SECONDARY } from './ui'

const JSON_FILES = 'application/json,.json'

/**
 * A button that fills a form from a JSON file. The form takes the file's
 * content as a draft: nothing is sent until it is saved.
 */
export function JsonImport({
  hint,
  onImport,
}: {
  /** What the file should hold. */
  hint: string
  onImport: (value: Imported) => void
}) {
  const { t } = useTranslation('content')
  const [file, setFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function read(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const chosen = input.files?.[0]
    // The same file may be picked again, after it was edited.
    input.value = ''

    if (!chosen) return

    const result = await readImport(chosen)

    if (result.error) {
      setFile(null)
      setError(
        result.error === 'invalid_json' ? t('invalid_json', { ns: 'errors' }) : t('importNotObject')
      )
      return
    }

    setError(null)
    setFile(chosen.name)
    onImport(result.value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <label className={`${SECONDARY} cursor-pointer focus-within:border-accent`}>
          <FileUp aria-hidden className="size-4" />
          {t('importJson')}
          <input type="file" accept={JSON_FILES} onChange={read} className="sr-only" />
        </label>
      </div>
      {error ? (
        <FieldError message={error} />
      ) : (
        <p role="status" className="text-label text-subtle">
          {file === null ? hint : t('importedFrom', { file })}
        </p>
      )}
    </div>
  )
}
