import { useTranslation } from 'react-i18next'

import { FieldError } from './field'
import { errorUnder, type FieldErrors } from './form_errors'
import { IMPORTED_CATALOGUES, type Imported, type ImportedCatalogue, textOf } from './imports'

/** Every list a file may carry, in the order they are shown. */
const LISTS = ['actionTypes', ...IMPORTED_CATALOGUES] as const
import { SECTION } from './ui'

/**
 * What an imported file will create besides the form: each catalogue and list
 * it carries, entry by entry, by reference — with what the server found wrong
 * in an entry, once it was sent. To be checked before anything is created.
 */
export function CatalogueSummary({
  catalogues,
  errors,
}: {
  catalogues: Partial<Record<ImportedCatalogue | 'actionTypes', Imported[]>>
  errors: FieldErrors
}) {
  const { t } = useTranslation('content')
  const carried = LISTS.filter((list) => (catalogues[list] ?? []).length > 0)

  if (carried.length === 0) {
    return null
  }

  return (
    <section className={`${SECTION} flex flex-col gap-4`}>
      <div>
        <h2 className="font-serif text-[1.25rem] text-text">{t('importedCatalogues')}</h2>
        <p className="mt-1 text-label text-subtle">{t('importedCataloguesHint')}</p>
      </div>
      {carried.map((list) => {
        const entries = catalogues[list] ?? []

        return (
          <div key={list} className="flex flex-col gap-1.5">
            <h3 className="text-label font-medium text-muted">
              {t(`catalogueCount.${list}`, { count: entries.length })}
            </h3>
            <ul className="flex flex-col gap-1">
              {entries.map((entry, index) => {
                const error = errorUnder(errors, `${list}.${index}`)

                return (
                  <li key={index} className="flex flex-col gap-1">
                    <span className="font-mono text-label text-text">
                      {textOf(entry.reference) || textOf(entry.actionType) || t('noReference')}
                    </span>
                    {error && <FieldError message={error} />}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
