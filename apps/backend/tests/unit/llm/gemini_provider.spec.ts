import { test } from '@japa/runner'
import type { GenerateContentResponse } from '@google/genai'

import type { LlmProviderRequest } from '#services/llm/types'
import { buildGeminiConfig, buildUsage } from '#services/llm/providers/gemini_provider'

/**
 * Covers the two cost-bearing decisions of the Gemini adapter. Both are pure
 * translations, so no client is constructed and no request is ever sent.
 */

function request(overrides: Partial<LlmProviderRequest> = {}): LlmProviderRequest {
  return {
    step: 'arbitration',
    systemPrompt: 'system',
    userMessage: 'user',
    ...overrides,
  }
}

function response(usageMetadata: Record<string, number>): GenerateContentResponse {
  return { usageMetadata } as unknown as GenerateContentResponse
}

test.group('GeminiProvider | token accounting', () => {
  test('maps every vendor counter onto the neutral shape', ({ assert }) => {
    const usage = buildUsage(
      response({
        promptTokenCount: 23,
        candidatesTokenCount: 10,
        thoughtsTokenCount: 4,
        totalTokenCount: 37,
      })
    )

    assert.deepEqual(usage, {
      inputTokens: 23,
      outputTokens: 10,
      reasoningTokens: 4,
      totalTokens: 37,
    })
  })

  test('reads a missing response as zeros, never undefined', ({ assert }) => {
    /**
     * `turn_log.llm_usage` must always hold a usable number: the real cost per
     * turn is the input to the monetisation decision, and a silent `undefined`
     * would corrupt the aggregate without anyone noticing.
     */
    assert.deepEqual(buildUsage(undefined), {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    })
  })

  test('fills the gaps when the vendor reports partial metadata', ({ assert }) => {
    const usage = buildUsage(response({ promptTokenCount: 19 }))

    assert.deepEqual(usage, {
      inputTokens: 19,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    })
  })
})

test.group('GeminiProvider | request config', () => {
  test('disables reasoning by default', ({ assert }) => {
    /**
     * gemini-2.5-flash reasons by default. Those tokens are billed and never
     * surface as content, and the deterministic steps gain nothing from them.
     */
    assert.equal(buildGeminiConfig(request()).thinkingConfig?.thinkingBudget, 0)
    assert.equal(buildGeminiConfig(request({ reasoning: false })).thinkingConfig?.thinkingBudget, 0)
  })

  test('enables reasoning when the caller asks for it', ({ assert }) => {
    assert.equal(buildGeminiConfig(request({ reasoning: true })).thinkingConfig?.thinkingBudget, -1)
  })

  test('asks for JSON only when a schema is supplied', ({ assert }) => {
    const schema = { type: 'object', properties: { status: { type: 'string' } } }

    const structured = buildGeminiConfig(request({ jsonSchema: schema }))
    assert.equal(structured.responseMimeType, 'application/json')
    assert.strictEqual(structured.responseJsonSchema, schema)

    const free = buildGeminiConfig(request())
    assert.isUndefined(free.responseMimeType)
    assert.isUndefined(free.responseJsonSchema)
  })

  test('forwards the system prompt and the abort signal', ({ assert }) => {
    const signal = AbortSignal.timeout(1000)
    const config = buildGeminiConfig(request({ signal }))

    assert.equal(config.systemInstruction, 'system')
    assert.strictEqual(config.abortSignal, signal)
  })
})
