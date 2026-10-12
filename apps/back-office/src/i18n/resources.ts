import auth from './locales/en/auth.json'
import catalogues from './locales/en/catalogues.json'
import common from './locales/en/common.json'
import content from './locales/en/content.json'
import errors from './locales/en/errors.json'
import worlds from './locales/en/worlds.json'

/**
 * English is the base language: bundled with the app, and the source the
 * translation keys are typed from (`i18next.d.ts`).
 */
export const defaultNS = 'common'

export const en = { common, errors, auth, content, worlds, catalogues }
