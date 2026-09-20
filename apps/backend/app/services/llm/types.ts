/**
 * Provider-agnostic contract for the LLM Gateway.
 *
 * Nothing in this file may reference a specific vendor: swapping provider means
 * writing a new adapter under `providers/` and pointing `config/llm.ts` at it.
 */

/**
 * Pipeline step a call belongs to. Used for logging and per-turn cost tracking,
 * and later to select a different model per step (see roadmap, Phase 3).
 */
export type LlmStep = 'arbitration' | 'narration' | 'extraction' | 'summary'

/**
 * Token accounting for a single call. Persisted per turn so the real cost of a
 * game session can be measured (see roadmap, Phase 1).
 */
export type LlmUsage = {
  inputTokens: number
  outputTokens: number
  /** Provider-side reasoning tokens, billed but never returned as content. */
  reasoningTokens: number
  totalTokens: number
}

export type LlmCallMetadata = {
  provider: string
  model: string
  step: LlmStep
  usage: LlmUsage
  durationMs: number
}

export type LlmResult<TContent> = {
  content: TContent
  metadata: LlmCallMetadata
}

export type LlmGenerationOptions = {
  /**
   * Static per-step prompt: role, constraints, output schema. Never built from
   * player input — dynamic game data belongs in `userMessage`.
   */
  systemPrompt: string

  /**
   * Turn data, always introduced to the model as game data rather than as
   * instructions (prompt-injection defence).
   */
  userMessage: string

  temperature?: number
  maxOutputTokens?: number

  /**
   * JSON Schema the answer must conform to. When set, the provider is asked for
   * a JSON-only answer. Plain JSON Schema keeps this contract vendor-neutral.
   */
  jsonSchema?: Record<string, unknown>

  /**
   * Allow provider-side reasoning. Off by default: the deterministic steps do
   * not benefit from it and it is billed.
   */
  reasoning?: boolean

  signal?: AbortSignal
}

/**
 * What an adapter actually receives: the caller's options plus the step, which
 * the gateway attaches so failures and token usage can be traced back to it.
 */
export type LlmProviderRequest = LlmGenerationOptions & { step: LlmStep }

/**
 * Port implemented by every provider adapter.
 *
 * An adapter translates to and from the vendor SDK and maps vendor failures to
 * `LlmError`. It performs no retry and no business logic.
 */
export interface LlmProvider {
  readonly name: string
  readonly model: string

  /** One-shot generation, returning the raw answer text. */
  generate(request: LlmProviderRequest): Promise<LlmResult<string>>

  /**
   * Streaming generation. Yields text chunks as they arrive and returns the call
   * metadata once the stream is exhausted. Feeds the `narration_chunk` SSE event
   * (see architecture doc, section 8bis).
   */
  stream(request: LlmProviderRequest): AsyncGenerator<string, LlmCallMetadata, void>
}
