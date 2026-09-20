import logger from '@adonisjs/core/services/logger'

import { LlmError } from './errors.js'
import type {
  LlmCallMetadata,
  LlmGenerationOptions,
  LlmProvider,
  LlmResult,
  LlmStep,
} from './types.js'

export type LlmGatewayOptions = {
  /** Hard ceiling on a single call, aborted past it. */
  requestTimeoutMs: number
}

/**
 * Single entry point for every LLM call in the application.
 *
 * It owns everything that must behave the same whatever the provider — timeout,
 * error categories, JSON parsing, token accounting — and delegates the vendor
 * call itself to an `LlmProvider` adapter.
 *
 * Deliberately absent: retries. A transient failure is surfaced to the player
 * with a category-specific message; a schema failure means the prompt needs
 * fixing, not retrying (see roadmap, Phase 9 for the eventual reassessment).
 */
export class LlmGateway {
  #provider: LlmProvider
  #options: LlmGatewayOptions

  constructor(provider: LlmProvider, options: LlmGatewayOptions) {
    this.#provider = provider
    this.#options = options
  }

  get provider(): string {
    return this.#provider.name
  }

  get model(): string {
    return this.#provider.model
  }

  /**
   * Free-text generation — the narration step.
   */
  async generateText(step: LlmStep, options: LlmGenerationOptions): Promise<LlmResult<string>> {
    const result = await this.#run(step, options, (request) => this.#provider.generate(request))
    this.#logUsage(result.metadata)
    return result
  }

  /**
   * Structured generation — the arbitration and extraction steps.
   *
   * Guarantees a parsed object, not that it is sound: the caller still validates
   * the payload before anything reaches the game state.
   */
  async generateJson<TContent>(
    step: LlmStep,
    options: LlmGenerationOptions & { jsonSchema: Record<string, unknown> }
  ): Promise<LlmResult<TContent>> {
    const { content, metadata } = await this.generateText(step, options)

    return { content: this.#parseJson<TContent>(content, step), metadata }
  }

  /**
   * Streaming free-text generation, for progressive narration over SSE.
   *
   * Yields text chunks and returns the call metadata once exhausted:
   *
   * ```ts
   * const stream = llm.streamText('narration', options)
   * let next = await stream.next()
   * while (!next.done) {
   *   transmit.broadcast(channel, { narration_chunk: next.value })
   *   next = await stream.next()
   * }
   * const metadata = next.value
   * ```
   */
  async *streamText(
    step: LlmStep,
    options: LlmGenerationOptions
  ): AsyncGenerator<string, LlmCallMetadata, void> {
    const { signal, cleanup } = this.#withTimeout(options.signal)

    try {
      const metadata = yield* this.#provider.stream({ ...options, step, signal })
      this.#logUsage(metadata)
      return metadata
    } catch (error) {
      throw this.#categorize(error, step, signal)
    } finally {
      cleanup()
    }
  }

  async #run(
    step: LlmStep,
    options: LlmGenerationOptions,
    call: (request: LlmGenerationOptions & { step: LlmStep }) => Promise<LlmResult<string>>
  ): Promise<LlmResult<string>> {
    const { signal, cleanup } = this.#withTimeout(options.signal)

    try {
      return await call({ ...options, step, signal })
    } catch (error) {
      throw this.#categorize(error, step, signal)
    } finally {
      cleanup()
    }
  }

  /**
   * Combines the gateway timeout with any caller-supplied signal, so a cancelled
   * turn also cancels the in-flight call.
   */
  #withTimeout(callerSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const timeoutSignal = AbortSignal.timeout(this.#options.requestTimeoutMs)

    if (!callerSignal) {
      return { signal: timeoutSignal, cleanup: () => {} }
    }

    return { signal: AbortSignal.any([timeoutSignal, callerSignal]), cleanup: () => {} }
  }

  /**
   * An aborted call is reported as a timeout, which the adapter cannot tell apart
   * from a caller-side cancellation.
   */
  #categorize(error: unknown, step: LlmStep, signal: AbortSignal): unknown {
    if (error instanceof LlmError) {
      return error
    }

    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return new LlmError(
        'timeout',
        `The model did not answer within ${this.#options.requestTimeoutMs}ms.`,
        { step, provider: this.#provider.name, cause: error }
      )
    }

    return error
  }

  #parseJson<TContent>(content: string, step: LlmStep): TContent {
    try {
      return JSON.parse(stripCodeFence(content)) as TContent
    } catch (error) {
      throw new LlmError('invalid_output', 'The model did not return valid JSON.', {
        step,
        provider: this.#provider.name,
        cause: error,
      })
    }
  }

  /**
   * Per-call token accounting. Turn-level persistence into `turn_log` is the
   * pipeline's job — this only makes consumption visible in the logs.
   */
  #logUsage(metadata: LlmCallMetadata): void {
    logger.info(
      {
        provider: metadata.provider,
        model: metadata.model,
        step: metadata.step,
        durationMs: metadata.durationMs,
        ...metadata.usage,
      },
      'llm call completed'
    )
  }
}

/**
 * Some providers wrap JSON answers in a markdown fence despite being asked for
 * raw JSON.
 */
function stripCodeFence(content: string): string {
  const trimmed = content.trim()

  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}
