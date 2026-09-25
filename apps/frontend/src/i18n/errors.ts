import { ApiError, NetworkError } from '@/api/client'
import i18n from './index'
import type { en } from './resources'

export type ErrorCode = keyof typeof en.errors

/**
 * The text a player reads for an error. The `code` is a closed list the front
 * translates; the API's `message` stays in English whatever the interface
 * language, so it is only the fallback for a code the front does not know yet
 * (front spec, section 5.3.6).
 */
export function errorMessage(error: { code: string; message?: string }): string {
  return i18n.t(error.code as ErrorCode, {
    ns: 'errors',
    // An empty message is no better than none.
    defaultValue: error.message || i18n.t('unexpected', { ns: 'errors' }),
  })
}

/**
 * The same, for anything a request can throw: a coded failure (API or
 * network) says what it is, anything else stays generic.
 */
export function failureMessage(error: unknown): string {
  if ((error instanceof ApiError || error instanceof NetworkError) && error.code) {
    return errorMessage({ code: error.code, message: error.message })
  }

  return errorMessage({ code: 'unexpected' })
}
