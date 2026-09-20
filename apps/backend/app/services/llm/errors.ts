import type { LlmStep } from './types.js'

/**
 * Error categories surfaced to the player, one message per category.
 *
 * Mirrors the error-handling decision for the project: no automatic retry, and a
 * specific message per failure kind rather than a generic one.
 */
export type LlmErrorCategory =
  /** The call exceeded the configured timeout. */
  | 'timeout'
  /** The provider could not be reached (DNS, network, connection refused). */
  | 'provider_unreachable'
  /** The provider answered with an HTTP error (auth, quota, 5xx). */
  | 'provider_http_error'
  /** The answer was empty, was not valid JSON, or did not match the schema. */
  | 'invalid_output'

export class LlmError extends Error {
  readonly category: LlmErrorCategory
  readonly step: LlmStep
  readonly provider: string
  /** HTTP status, when the provider returned one. */
  readonly status?: number

  constructor(
    category: LlmErrorCategory,
    message: string,
    context: { step: LlmStep; provider: string; status?: number; cause?: unknown }
  ) {
    super(message, { cause: context.cause })
    this.name = 'LlmError'
    this.category = category
    this.step = context.step
    this.provider = context.provider
    this.status = context.status
  }
}
