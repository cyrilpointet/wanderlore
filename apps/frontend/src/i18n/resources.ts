import common from './locales/en/common.json'
import enums from './locales/en/enums.json'
import errors from './locales/en/errors.json'

/**
 * English is the base language: bundled with the app, and the source the
 * translation keys are typed from (`i18next.d.ts`). Any other language is
 * loaded on demand (`index.ts`) and must mirror these namespaces.
 */
export const defaultNS = 'common'

export const en = { common, enums, errors }
