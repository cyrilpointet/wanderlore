import { ApiError, GoogleGenAI } from '@google/genai'
import type { GenerateContentConfig, GenerateContentResponse } from '@google/genai'

import { LlmError } from '../errors.js'
import type {
  LlmCallMetadata,
  LlmProvider,
  LlmProviderRequest,
  LlmResult,
  LlmUsage,
} from '../types.js'

export type GeminiProviderOptions = {
  apiKey: string
  model: string
}

/**
 * Google Gemini adapter.
 *
 * The only file in the codebase aware of `@google/genai`. It translates the
 * neutral request into the vendor payload and maps vendor failures onto
 * `LlmError` categories — no retry, no business logic.
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'google-gemini'
  readonly model: string

  #client: GoogleGenAI

  constructor(options: GeminiProviderOptions) {
    this.model = options.model
    this.#client = new GoogleGenAI({ apiKey: options.apiKey })
  }

  async generate(request: LlmProviderRequest): Promise<LlmResult<string>> {
    const startedAt = Date.now()

    const response = await this.#call(request)
    const text = response.text

    if (!text) {
      throw new LlmError('invalid_output', 'The model returned an empty answer.', {
        step: request.step,
        provider: this.name,
      })
    }

    return {
      content: text,
      metadata: this.#buildMetadata(request, response, startedAt),
    }
  }

  async *stream(request: LlmProviderRequest): AsyncGenerator<string, LlmCallMetadata, void> {
    const startedAt = Date.now()

    const stream = await this.#callStream(request)

    let lastChunk: GenerateContentResponse | undefined
    let receivedText = false

    try {
      for await (const chunk of stream) {
        lastChunk = chunk
        if (chunk.text) {
          receivedText = true
          yield chunk.text
        }
      }
    } catch (error) {
      throw this.#toLlmError(error, request)
    }

    if (!receivedText) {
      throw new LlmError('invalid_output', 'The model returned an empty answer.', {
        step: request.step,
        provider: this.name,
      })
    }

    /**
     * Usage metadata is cumulative and only complete on the final chunk.
     */
    return this.#buildMetadata(request, lastChunk, startedAt)
  }

  async #call(request: LlmProviderRequest): Promise<GenerateContentResponse> {
    try {
      return await this.#client.models.generateContent({
        model: this.model,
        contents: request.userMessage,
        config: buildGeminiConfig(request),
      })
    } catch (error) {
      throw this.#toLlmError(error, request)
    }
  }

  async #callStream(request: LlmProviderRequest) {
    try {
      return await this.#client.models.generateContentStream({
        model: this.model,
        contents: request.userMessage,
        config: buildGeminiConfig(request),
      })
    } catch (error) {
      throw this.#toLlmError(error, request)
    }
  }

  #buildMetadata(
    request: LlmProviderRequest,
    response: GenerateContentResponse | undefined,
    startedAt: number
  ): LlmCallMetadata {
    return {
      provider: this.name,
      model: this.model,
      step: request.step,
      usage: buildUsage(response),
      durationMs: Date.now() - startedAt,
    }
  }

  /**
   * Maps a vendor failure onto a category. Aborts are left untouched: only the
   * gateway knows whether it aborted the call on timeout.
   */
  #toLlmError(error: unknown, request: LlmProviderRequest): unknown {
    if (error instanceof LlmError || isAbortError(error)) {
      return error
    }

    const context = { step: request.step, provider: this.name, cause: error }

    if (error instanceof ApiError) {
      return new LlmError(
        'provider_http_error',
        `Gemini answered with HTTP ${error.status}: ${error.message}`,
        { ...context, status: error.status }
      )
    }

    return new LlmError('provider_unreachable', `Gemini could not be reached: ${describe(error)}`, {
      ...context,
    })
  }
}

/**
 * Translates the neutral request into the vendor payload.
 *
 * Module-level and exported so the cost-bearing decisions it encodes can be
 * asserted directly.
 *
 * @internal exported for testing
 */
export function buildGeminiConfig(request: LlmProviderRequest): GenerateContentConfig {
  const config: GenerateContentConfig = {
    systemInstruction: request.systemPrompt,
    abortSignal: request.signal,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,

    /**
     * Reasoning tokens are billed and never surface as content. Off unless the
     * caller asks for them.
     */
    thinkingConfig: { thinkingBudget: request.reasoning ? -1 : 0 },
  }

  if (request.jsonSchema) {
    config.responseMimeType = 'application/json'
    config.responseJsonSchema = request.jsonSchema
  }

  return config
}

/**
 * Maps vendor token accounting onto the neutral shape. Missing counters read as
 * zero rather than `undefined`, so a turn always records a usable number.
 *
 * @internal exported for testing
 */
export function buildUsage(response: GenerateContentResponse | undefined): LlmUsage {
  const usage = response?.usageMetadata

  return {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    reasoningTokens: usage?.thoughtsTokenCount ?? 0,
    totalTokens: usage?.totalTokenCount ?? 0,
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
