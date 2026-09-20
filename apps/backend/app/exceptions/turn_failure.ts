import { LlmError } from '#services/llm/errors'
import { TurnValidationError } from '#services/game/turn_validator'

/**
 * Turns a pipeline failure into a response the client can tell apart.
 *
 * The project decided against automatic retry, so a failure always reaches the
 * player. The least it can do is say which kind it was: waiting longer is a
 * sensible answer to a timeout and a pointless one to a rejected payload.
 *
 * Structured error logging is explicitly deferred to Phase 9.
 */
export type TurnFailure = {
  status: number
  code: string
  message: string
  /** Which pipeline step failed, when the failure knows. */
  step?: string
  /** Why the payload was refused, for a backend validation failure only. */
  reasons?: { field: string; rule: string; message: string }[]
}

const LLM_FAILURES: Record<string, { status: number; code: string; message: string }> = {
  timeout: {
    status: 504,
    code: 'llm_timeout',
    message: 'The game master took too long to answer. Try your action again.',
  },
  provider_unreachable: {
    status: 503,
    code: 'llm_unreachable',
    message: 'The game master could not be reached. Try again in a moment.',
  },
  provider_http_error: {
    status: 502,
    code: 'llm_http_error',
    message: 'The game master refused the request.',
  },
  invalid_output: {
    status: 502,
    code: 'llm_invalid_output',
    message: 'The game master answered something unusable. Try rephrasing your action.',
  },
}

export function describeTurnFailure(error: unknown): TurnFailure | null {
  if (error instanceof LlmError) {
    const failure = LLM_FAILURES[error.category]

    return failure ? { ...failure, step: error.step } : null
  }

  if (error instanceof TurnValidationError) {
    return {
      status: 422,
      code: 'turn_validation_failed',
      message: 'The game master proposed something the rules do not allow. Nothing was applied.',
      step: error.step,
      /**
       * Carried deliberately: at this phase the caller is a developer with
       * curl, and the rejected rule is the whole diagnosis.
       */
      reasons: error.reasons,
    }
  }

  return null
}
