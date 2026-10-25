import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

import { defaultNS, en } from './resources'

/**
 * Interface language only: the content a game master writes is never
 * translated here — its names by language are content, stored by the backend.
 *
 * English only, like the player front until Phase 11.
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
