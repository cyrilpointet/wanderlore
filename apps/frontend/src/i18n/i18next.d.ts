import 'i18next'
import type { defaultNS, en } from './resources'

/**
 * Keys are typed from the English files: an unknown key breaks the typecheck.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: typeof en
  }
}
