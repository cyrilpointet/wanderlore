import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

import { defaultNS, en } from './resources'

/**
 * Interface language only. Content labels come from the backend, and the
 * narration is written by the LLM in the game's language: neither goes
 * through here.
 *
 * Fixed to English in Phase 2; the player picks a language in Phase 9.
 */
export const LANGUAGE = 'en'

/**
 * Any language but English is split into its own chunks and fetched on first
 * use, so a new language never weighs on the initial bundle.
 */
const otherLanguages = import.meta.glob(['./locales/*/*.json', '!./locales/en/*.json'])

void i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(async (language: string, namespace: string) => {
      const load = otherLanguages[`./locales/${language}/${namespace}.json`]
      if (!load) throw new Error(`No ${namespace} translations for ${language}`)
      return load()
    })
  )
  .init({
    lng: LANGUAGE,
    fallbackLng: 'en',
    resources: { en },
    partialBundledLanguages: true,
    // English is bundled: ready on the first render, without a loading state.
    initAsync: false,
    ns: Object.keys(en),
    defaultNS,
    // React already escapes what it renders.
    interpolation: { escapeValue: false },
  })

export default i18n
