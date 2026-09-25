import { ApiError, NetworkError } from '@/api/client'
import type { Failure } from './turn_machine'

/**
 * How the front answers each way a turn can go wrong (front spec, section
 * 5.3.6). The text always comes from the error's `code`, translated
 * (`errorMessage()`); what is decided here is where it shows and what the
 * player can do about it.
 */

/** What a failed submission (the POST) leads to. */
export type SubmitOutcome =
  /** A failure card in the journal, with Retry and Edit. */
  | { kind: 'card'; failure: Failure; retryWithSameKey: boolean }
  /** An error under the field, the text kept for the player to correct. */
  | { kind: 'field'; failure: Failure }
  /** Another turn is already being played: wait for it rather than show an error. */
  | { kind: 'wait' }
  /** The session is gone: the sign-in redirect takes over, the draft stays. */
  | { kind: 'signed_out' }

export function classifySubmitError(error: unknown): SubmitOutcome {
  // No answer at all: the turn may have been recorded, so the same key goes again.
  if (error instanceof NetworkError) {
    return {
      kind: 'card',
      failure: { code: error.code, message: error.message },
      retryWithSameKey: true,
    }
  }

  if (!(error instanceof ApiError)) {
    return { kind: 'card', failure: { code: 'unexpected', message: '' }, retryWithSameKey: false }
  }

  if (error.status === 401) return { kind: 'signed_out' }

  if (error.code === 'turn_already_in_progress') return { kind: 'wait' }

  // The queue refused the turn, which is recorded as failed: trying again is a new turn.
  if (error.code === 'turn_queue_unavailable') {
    return {
      kind: 'card',
      failure: { code: error.code, message: error.message },
      retryWithSameKey: false,
    }
  }

  // The request validator refused the text itself: the answer belongs under the field.
  if (error.status === 422 && !error.code) {
    return { kind: 'field', failure: { code: inputErrorCode(error.body), message: error.message } }
  }

  // Any other server error may have come after the turn was recorded: same key, same turn.
  if (error.status >= 500) {
    return {
      kind: 'card',
      failure: { code: 'network_error', message: error.message },
      retryWithSameKey: true,
    }
  }

  return {
    kind: 'card',
    failure: { code: error.code ?? 'unexpected', message: error.message },
    retryWithSameKey: false,
  }
}

/** Which of the two actions a failure card puts forward. */
export type Emphasis = 'retry' | 'edit'

/**
 * An unusable answer from the model is likelier to come back if the same
 * words are sent again: rephrasing is the better way out. For anything else,
 * trying again is.
 */
export function emphasisOf(code: string): Emphasis {
  return code === 'llm_invalid_output' ? 'edit' : 'retry'
}

/**
 * The request validator answers in the framework's shape, without a code:
 * the rule that failed says what is wrong with the text.
 */
function inputErrorCode(body: unknown): string {
  const rule = firstRule(body)
  if (rule === 'maxLength') return 'input_too_long'
  if (rule === 'minLength' || rule === 'required') return 'input_empty'
  return 'input_invalid'
}

function firstRule(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return undefined
  const { errors } = body
  if (!Array.isArray(errors)) return undefined
  const [first] = errors as unknown[]
  return typeof first === 'object' && first !== null && 'rule' in first ? first.rule : undefined
}
