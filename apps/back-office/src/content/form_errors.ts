import { ApiError } from '@/api/client'
import { failureMessage } from '@/i18n/errors'
import i18n from '@/i18n'

/** Messages by field path (`skills.0.category`), as the backend names fields. */
export type FieldErrors = Record<string, string>

export type FormFailure = {
  /** What to show next to each faulty field. */
  fields: FieldErrors
  /** What to show above the form: a refusal not tied to one field, or anything else. */
  general: string | null
}

type ValidationError = { field?: unknown; rule?: unknown; message?: unknown }

/**
 * What went wrong with a save, in a form's terms. A validation error names
 * each faulty field; a refusal tied to a field (a reference taken or
 * changed) is shown on it; anything else goes above the form.
 */
export function formFailureOf(error: unknown): FormFailure {
  if (error instanceof ApiError && isRecord(error.body)) {
    const { errors, error: refusal } = error.body

    if (Array.isArray(errors)) {
      const fields: FieldErrors = {}

      for (const entry of errors as ValidationError[]) {
        if (typeof entry.field === 'string' && !(entry.field in fields)) {
          fields[entry.field] = validationMessage(entry)
        }
      }

      return { fields, general: null }
    }

    if (isRecord(refusal) && isRecord(refusal.details) && typeof refusal.details.field === 'string') {
      return { fields: { [refusal.details.field]: failureMessage(error) }, general: null }
    }
  }

  return { fields: {}, general: failureMessage(error) }
}

/** The message of a broken rule: ours when the rule is known, the backend's otherwise. */
function validationMessage(entry: ValidationError): string {
  const fallback = typeof entry.message === 'string' ? entry.message : undefined
  const rule = typeof entry.rule === 'string' ? entry.rule : 'unknown'

  return i18n.t(`rules.${rule}` as 'rules.required', {
    ns: 'errors',
    defaultValue: fallback ?? i18n.t('unexpected', { ns: 'errors' }),
  })
}

/** The first error found under a path: `skills.0` catches `skills.0.category`. */
export function errorUnder(fields: FieldErrors, path: string): string | undefined {
  if (fields[path]) return fields[path]

  const nested = Object.keys(fields).find((field) => field.startsWith(`${path}.`))
  return nested === undefined ? undefined : fields[nested]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
