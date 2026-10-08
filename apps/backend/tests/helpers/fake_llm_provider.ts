import type {
  LlmCallMetadata,
  LlmProvider,
  LlmProviderRequest,
  LlmResult,
  LlmUsage,
} from '#services/llm/types'

const RAW = Symbol('raw answer')

/** An answer returned verbatim within a `jsonSequence` — unreadable JSON, say. */
export type RawAnswer = { [RAW]: string }

export function rawAnswer(text: string): RawAnswer {
  return { [RAW]: text }
}

const STREAMED = Symbol('streamed answer')

/**
 * A free-text answer within a `jsonSequence`, served fragment by fragment by
 * `stream()`. An error among the fragments is thrown when reached: a stream
 * cut halfway.
 */
export type StreamedAnswer = { [STREAMED]: (string | Error)[] }

export function streamed(...chunks: (string | Error)[]): StreamedAnswer {
  return { [STREAMED]: chunks }
}

export type FakeLlmProviderOptions = {
  name?: string
  model?: string

  /** Answer returned by `generate()`. */
  text?: string

  /** Serialised to JSON and returned by `generate()`. */
  json?: unknown

  /**
   * One JSON answer per call, in order — for a turn that calls the model twice.
   * Wins over `json`. Running past the end throws rather than repeating the
   * last answer, so a pipeline that calls more often than the spec arranged for
   * fails loudly. A `rawAnswer()` entry is returned as is, not serialised; a
   * `streamed()` entry answers a `stream()` call — and only that.
   */
  jsonSequence?: unknown[]

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

  /**
   * Run as each request arrives, before the answer — to make something happen
   * while a call is in flight, such as time passing on a fake clock.
   */
  onRequest?: (request: LlmProviderRequest) => void
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
    this.#options.onRequest?.(request)

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
    this.#options.onRequest?.(request)

    for (const chunk of this.#chunks()) {
      await this.#wait(request.signal)

      if (this.#options.error) {
        throw this.#options.error
      }

      if (chunk instanceof Error) {
        throw chunk
      }

      yield chunk
    }

    if (this.#options.error) {
      throw this.#options.error
    }

    return this.#metadata(request)
  }

  #chunks(): (string | Error)[] {
    const answer = this.#nextInSequence()

    if (answer === undefined) {
      return this.#options.chunks ?? []
    }

    if (answer !== null && typeof answer === 'object' && STREAMED in answer) {
      return (answer as StreamedAnswer)[STREAMED]
    }

    throw new Error(
      'FakeLlmProvider was asked to stream, but the answer arranged is not streamed().'
    )
  }

  /** The answer arranged for the call being made, or `undefined` with no sequence. */
  #nextInSequence(): unknown {
    const sequence = this.#options.jsonSequence

    if (sequence === undefined) {
      return undefined
    }

    /** `requests` was pushed before this ran, so it doubles as the call index. */
    const index = this.requests.length - 1

    if (index >= sequence.length) {
      throw new Error(
        `FakeLlmProvider ran out of answers after ${sequence.length} call(s). ` +
          'Arrange as many answers as the code under test makes calls.'
      )
    }

    return sequence[index]
  }

  #content(): string {
    if (this.#options.raw !== undefined) {
      return this.#options.raw
    }

    if (this.#options.jsonSequence !== undefined) {
      const answer = this.#nextInSequence()

      if (answer !== null && typeof answer === 'object' && RAW in answer) {
        return (answer as RawAnswer)[RAW]
      }

      if (answer !== null && typeof answer === 'object' && STREAMED in answer) {
        throw new Error(
          'FakeLlmProvider was asked for a whole answer, but a streamed() one is arranged.'
        )
      }

      return JSON.stringify(answer)
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
