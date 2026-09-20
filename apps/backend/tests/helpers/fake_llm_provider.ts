import type {
  LlmCallMetadata,
  LlmProvider,
  LlmProviderRequest,
  LlmResult,
  LlmUsage,
} from '#services/llm/types'

export type FakeLlmProviderOptions = {
  name?: string
  model?: string

  /** Answer returned by `generate()`. */
  text?: string

  /** Serialised to JSON and returned by `generate()`. */
  json?: unknown

  /** Returned verbatim — for fenced or malformed payloads. Wins over the rest. */
  raw?: string

  /** Thrown by `generate()` and `stream()`. */
  error?: Error

  /** Chunks yielded by `stream()`. */
  chunks?: string[]

  /** Folded into the returned metadata; missing fields default to zero. */
  usage?: Partial<LlmUsage>
  durationMs?: number

  /**
   * Delay before answering, and between stream chunks. Honours the abort
   * signal — see the note on the class.
   */
  delayMs?: number
}

/**
 * Test double for the `LlmProvider` port.
 *
 * It exists so the whole pipeline can be exercised without a network call, a
 * bill, or a flaky assertion. Beyond these gateway specs it is the seam the
 * Phase 1, 3 and 4 pipeline tests will build on.
 *
 * It **must** honour `request.signal`: `LlmGateway` only forwards the signal to
 * the provider, it does not race the promise itself. A double that ignored the
 * signal would make timeout tests hang until the suite deadline instead of
 * failing fast.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name: string
  readonly model: string

  /** Every request received, in order — assert on what the gateway forwards. */
  readonly requests: LlmProviderRequest[] = []

  #options: FakeLlmProviderOptions

  constructor(options: FakeLlmProviderOptions = {}) {
    this.#options = options
    this.name = options.name ?? 'fake'
    this.model = options.model ?? 'fake-model'
  }

  async generate(request: LlmProviderRequest): Promise<LlmResult<string>> {
    this.requests.push(request)

    await this.#wait(request.signal)

    if (this.#options.error) {
      throw this.#options.error
    }

    return {
      content: this.#content(),
      metadata: this.#metadata(request),
    }
  }

  async *stream(request: LlmProviderRequest): AsyncGenerator<string, LlmCallMetadata, void> {
    this.requests.push(request)

    for (const chunk of this.#options.chunks ?? []) {
      await this.#wait(request.signal)

      if (this.#options.error) {
        throw this.#options.error
      }

      yield chunk
    }

    if (this.#options.error) {
      throw this.#options.error
    }

    return this.#metadata(request)
  }

  #content(): string {
    if (this.#options.raw !== undefined) {
      return this.#options.raw
    }

    if (this.#options.json !== undefined) {
      return JSON.stringify(this.#options.json)
    }

    return this.#options.text ?? ''
  }

  #metadata(request: LlmProviderRequest): LlmCallMetadata {
    const usage = this.#options.usage ?? {}

    return {
      provider: this.name,
      model: this.model,
      step: request.step,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        reasoningTokens: usage.reasoningTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
      durationMs: this.#options.durationMs ?? 0,
    }
  }

  /**
   * Resolves after `delayMs`, or rejects as soon as the signal aborts.
   */
  async #wait(signal?: AbortSignal): Promise<void> {
    const delayMs = this.#options.delayMs

    if (signal?.aborted) {
      throw abortError()
    }

    if (!delayMs) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer)
        reject(abortError())
      }

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, delayMs)

      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}

/**
 * Mirrors what a fetch-based SDK throws on abort, which is what
 * `LlmGateway.#categorize` keys on.
 */
function abortError(): Error {
  return Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
}
