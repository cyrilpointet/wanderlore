import { test } from '@japa/runner'

import { LlmError } from '#services/llm/errors'
import { LlmGateway } from '#services/llm/gateway'
import type { LlmStep } from '#services/llm/types'
import { FakeLlmProvider, type FakeLlmProviderOptions } from '#tests/helpers/fake_llm_provider'

/**
 * These specs import `#services/llm/gateway` directly, never `#services/llm`:
 * the latter builds the singleton from `config/llm.ts`, which instantiates a
 * real Gemini client. Nothing here touches the network.
 */

const ANY_SCHEMA = {
  type: 'object',
  properties: { status: { type: 'string' } },
  required: ['status'],
}

function buildGateway(options: FakeLlmProviderOptions = {}, requestTimeoutMs = 1000) {
  const provider = new FakeLlmProvider(options)
  return { provider, gateway: new LlmGateway(provider, { requestTimeoutMs }) }
}

function textOptions(text: string) {
  return { systemPrompt: 'system', userMessage: text }
}

function jsonOptions() {
  return { ...textOptions('payload'), jsonSchema: ANY_SCHEMA }
}

test.group('LlmGateway | JSON parsing', () => {
  const parsed = [
    { label: 'a bare JSON object', raw: '{"status":"ok"}' },
    { label: 'a json-tagged code fence', raw: '```json\n{"status":"ok"}\n```' },
    { label: 'an untagged code fence', raw: '```\n{"status":"ok"}\n```' },
    { label: 'surrounding whitespace', raw: '  \n {"status":"ok"} \n ' },
  ]

  for (const { label, raw } of parsed) {
    test(`parses ${label}`, async ({ assert }) => {
      const { gateway } = buildGateway({ raw })

      const { content } = await gateway.generateJson<{ status: string }>(
        'arbitration',
        jsonOptions()
      )

      assert.deepEqual(content, { status: 'ok' })
    })
  }

  test('reports unparsable output as invalid_output', async ({ assert }) => {
    const { gateway } = buildGateway({ raw: 'Sure! Here is your answer.' })

    const error = await gateway
      .generateJson('extraction', jsonOptions())
      .then(() => null)
      .catch((caught) => caught)

    assert.instanceOf(error, LlmError)
    assert.equal(error.category, 'invalid_output')
    assert.equal(error.step, 'extraction')
    assert.equal(error.provider, 'fake')
    assert.instanceOf(error.cause, SyntaxError)
  })

  test('forwards the JSON schema to the provider verbatim', async ({ assert }) => {
    const { gateway, provider } = buildGateway({ raw: '{"status":"ok"}' })

    await gateway.generateJson('arbitration', jsonOptions())

    /**
     * Pins the vendor-neutral contract: the port takes plain JSON Schema, and
     * translating it is the adapter's job.
     */
    assert.strictEqual(provider.requests[0].jsonSchema, ANY_SCHEMA)
  })
})

test.group('LlmGateway | error categorisation', () => {
  const categories = ['provider_http_error', 'provider_unreachable', 'invalid_output'] as const

  for (const category of categories) {
    test(`rethrows a provider ${category} untouched`, async ({ assert }) => {
      const thrown = new LlmError(category, 'provider said no', {
        step: 'narration',
        provider: 'fake',
      })
      const { gateway } = buildGateway({ error: thrown })

      const error = await gateway
        .generateText('narration', textOptions('hello'))
        .then(() => null)
        .catch((caught) => caught)

      /**
       * Identity, not just category: an already-categorised error must never be
       * re-wrapped, or the original cause and status would be lost.
       */
      assert.strictEqual(error, thrown)
    })
  }

  test('leaves an uncategorised error alone rather than guessing', async ({ assert }) => {
    const thrown = new TypeError('something unexpected')
    const { gateway } = buildGateway({ error: thrown })

    const error = await gateway
      .generateText('narration', textOptions('hello'))
      .then(() => null)
      .catch((caught) => caught)

    assert.strictEqual(error, thrown)
    assert.notInstanceOf(error, LlmError)
  })

  test('reports a call exceeding the timeout as timeout', async ({ assert }) => {
    const { gateway } = buildGateway({ delayMs: 1000, text: 'too late' }, 25)

    const error = await gateway
      .generateText('narration', textOptions('hello'))
      .then(() => null)
      .catch((caught) => caught)

    assert.instanceOf(error, LlmError)
    assert.equal(error.category, 'timeout')
    assert.include(error.message, '25ms')
    assert.isDefined(error.cause)
  })

  test('reports a caller cancellation as timeout too', async ({ assert }) => {
    const { gateway } = buildGateway({ delayMs: 1000, text: 'too late' }, 5000)
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)

    const error = await gateway
      .generateText('narration', { ...textOptions('hello'), signal: controller.signal })
      .then(() => null)
      .catch((caught) => caught)

    /**
     * Documents a known conflation: `#categorize` cannot tell a caller-side
     * cancellation from a timeout, so both surface as `timeout`. Worth pinning
     * so it stays a decision rather than folklore — if a cancelled turn ever
     * needs its own category, this test is where it starts.
     */
    assert.instanceOf(error, LlmError)
    assert.equal(error.category, 'timeout')
  })
})

test.group('LlmGateway | metadata', () => {
  test('returns the provider metadata without inventing numbers', async ({ assert }) => {
    const usage = {
      inputTokens: 23,
      outputTokens: 10,
      reasoningTokens: 4,
      totalTokens: 37,
    }
    const { gateway } = buildGateway({ text: 'narrated', usage, durationMs: 836 })

    const { content, metadata } = await gateway.generateText('narration', textOptions('hello'))

    assert.equal(content, 'narrated')
    assert.deepEqual(metadata.usage, usage)
    assert.equal(metadata.durationMs, 836)
    assert.equal(metadata.provider, 'fake')
    assert.equal(metadata.model, 'fake-model')
  })

  test('preserves metadata across JSON parsing', async ({ assert }) => {
    const { gateway } = buildGateway({
      raw: '{"status":"ok"}',
      usage: { totalTokens: 33 },
    })

    const { metadata } = await gateway.generateJson('arbitration', jsonOptions())

    assert.equal(metadata.usage.totalTokens, 33)
  })

  const steps: LlmStep[] = ['arbitration', 'narration', 'extraction', 'summary']

  for (const step of steps) {
    test(`attaches the "${step}" step to the provider request`, async ({ assert }) => {
      const { gateway, provider } = buildGateway({ text: 'ok' })

      const { metadata } = await gateway.generateText(step, textOptions('hello'))

      assert.equal(provider.requests[0].step, step)
      assert.equal(metadata.step, step)
    })
  }

  test('leaves reasoning off unless the caller asks for it', async ({ assert }) => {
    const { gateway, provider } = buildGateway({ text: 'ok' })

    await gateway.generateText('arbitration', textOptions('hello'))
    await gateway.generateText('narration', { ...textOptions('hello'), reasoning: true })

    /**
     * The gateway is pass-through; turning `undefined` into a disabled thinking
     * budget is the adapter's call — see gemini_provider.spec.ts.
     */
    assert.isUndefined(provider.requests[0].reasoning)
    assert.isTrue(provider.requests[1].reasoning)
  })
})

test.group('LlmGateway | streaming', () => {
  test('yields chunks in order and returns metadata', async ({ assert }) => {
    const { gateway } = buildGateway({
      chunks: ['The guard ', 'steps ', 'aside.'],
      usage: { totalTokens: 22 },
    })

    const stream = gateway.streamText('narration', textOptions('hello'))
    const chunks: string[] = []

    /**
     * Driven with `next()` rather than `for await`, which silently discards a
     * generator's return value — and that return value is the metadata the SSE
     * pipeline needs to write into `turn_log`.
     */
    let next = await stream.next()
    while (!next.done) {
      chunks.push(next.value)
      next = await stream.next()
    }

    assert.deepEqual(chunks, ['The guard ', 'steps ', 'aside.'])
    assert.equal(next.value.usage.totalTokens, 22)
    assert.equal(next.value.step, 'narration')
  })

  test('categorises a provider failure raised mid-stream', async ({ assert }) => {
    const thrown = new LlmError('provider_http_error', 'boom', {
      step: 'narration',
      provider: 'fake',
      status: 503,
    })
    const { gateway } = buildGateway({ chunks: ['a', 'b'], error: thrown })

    const error = await gateway
      .streamText('narration', textOptions('hello'))
      .next()
      .then(() => null)
      .catch((caught) => caught)

    assert.strictEqual(error, thrown)
  })

  test('reports a stream exceeding the timeout as timeout', async ({ assert }) => {
    const { gateway } = buildGateway({ chunks: ['a', 'b'], delayMs: 1000 }, 25)

    const error = await gateway
      .streamText('narration', textOptions('hello'))
      .next()
      .then(() => null)
      .catch((caught) => caught)

    assert.instanceOf(error, LlmError)
    assert.equal(error.category, 'timeout')
  })
})
