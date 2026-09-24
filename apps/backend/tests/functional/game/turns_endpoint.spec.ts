import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'

import queue from '#services/queue'
import { PLAY_TURN_QUEUE } from '#services/game/turn_service'
import type { MemoryQueue } from '#services/queue/drivers/memory_queue'

import { LlmError, type LlmErrorCategory } from '#services/llm/errors'
import { ConcurrentTurnError, QueueUnavailableError } from '#services/game/errors'
import { TurnValidationError } from '#services/game/turn_validator'
import { describeTurnFailure } from '#exceptions/turn_failure'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'

/**
 * The route and its authorisation are exercised over HTTP. The failure mapping
 * is exercised directly: forcing a provider timeout through a live request
 * would mean wiring a fake into the running server, which is what the pipeline
 * specs already cover.
 */
test.group('Turns endpoint | authorisation', (group) => {
  useTransaction(group)

  test('refuses an anonymous request', async ({ client }) => {
    const sessionId = await createSession(await createUser())

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .withCsrfToken()

    response.assertStatus(401)
  })

  test('rejects an empty action', async ({ client }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: '   ' })
      .header('Idempotency-Key', randomUUID())
      .loginAs(await user(userId))
      .withCsrfToken()

    response.assertStatus(422)
  })

  test('rejects a submission without an idempotency key', async ({ client }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .loginAs(await user(userId))
      .withCsrfToken()

    /**
     * Without a key a submission cannot be told apart from its own
     * repetition, which is the double turn the key exists to prevent.
     */
    response.assertStatus(422)
  })

  test('rejects an idempotency key that is not a uuid', async ({ client }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .header('Idempotency-Key', 'click-1')
      .loginAs(await user(userId))
      .withCsrfToken()

    response.assertStatus(422)
  })

  test('accepts a turn at once, pending, and queues it', async ({ client, assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .header('Idempotency-Key', randomUUID())
      .loginAs(await user(userId))
      .withCsrfToken()

    response.assertStatus(202)
    const { id, status } = (response.body() as { data: { id: string; status: string } }).data

    /**
     * Answered before it is played: the worker never starts in tests, so the
     * job simply waits in the in-memory queue.
     */
    assert.equal(status, 'pending')
    assert.deepInclude((queue as MemoryQueue).jobs, {
      queue: PLAY_TURN_QUEUE,
      payload: { turnId: id },
    })
  })

  test('answers a repeated submission with the same turn', async ({ client, assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)
    const key = randomUUID()

    const send = async () =>
      client
        .post(`/api/v1/sessions/${sessionId}/turns`)
        .json({ playerInput: 'I look around.' })
        .header('Idempotency-Key', key)
        .loginAs(await user(userId))
        .withCsrfToken()

    const first = await send()
    const again = await send()

    again.assertStatus(202)
    assert.equal(
      (again.body() as { data: { id: string } }).data.id,
      (first.body() as { data: { id: string } }).data.id
    )
  })

  test("hides someone else's session behind a not-found", async ({ client }) => {
    const intruder = await createUser()
    const sessionId = await createSession(await createUser())

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .header('Idempotency-Key', randomUUID())
      .loginAs(await user(intruder))
      .withCsrfToken()

    /**
     * Not a 403: telling an intruder that a session exists but is not theirs
     * leaks more than refusing to acknowledge it at all.
     */
    response.assertStatus(404)
  })
})

test.group('Turn failures | distinguishable categories', () => {
  const categories: [LlmErrorCategory, number, string][] = [
    ['timeout', 504, 'llm_timeout'],
    ['provider_unreachable', 503, 'llm_unreachable'],
    ['provider_http_error', 502, 'llm_http_error'],
    ['invalid_output', 502, 'llm_invalid_output'],
  ]

  for (const [category, status, code] of categories) {
    test(`maps ${category} to ${status} ${code}`, ({ assert }) => {
      const failure = describeTurnFailure(
        new LlmError(category, 'boom', { step: 'arbitration', provider: 'fake' })
      )

      assert.equal(failure?.status, status)
      assert.equal(failure?.code, code)
      assert.equal(failure?.step, 'arbitration')
    })
  }

  test('maps a backend validation failure to 422 with its reasons', ({ assert }) => {
    const failure = describeTurnFailure(
      new TurnValidationError('narration', [
        { field: 'effects.movement', rule: 'regex', message: 'Not a stable reference.' },
      ])
    )

    assert.equal(failure?.status, 422)
    assert.equal(failure?.code, 'turn_validation_failed')
    assert.lengthOf(failure!.reasons!, 1)
  })

  test('gives every category a code of its own', ({ assert }) => {
    const codes = categories.map(([category]) =>
      describeTurnFailure(new LlmError(category, 'boom', { step: 'arbitration', provider: 'fake' }))
    )

    /**
     * The exit criterion of the ticket: two categories may share an HTTP
     * status, so the code is what the client actually tells them apart by.
     */
    assert.equal(new Set(codes.map((failure) => failure?.code)).size, categories.length)
  })

  test('maps a turn that could not be queued to 503', ({ assert }) => {
    const failure = describeTurnFailure(new QueueUnavailableError())

    assert.equal(failure?.status, 503)
    assert.equal(failure?.code, 'turn_queue_unavailable')
  })

  test('maps a racing turn to 409 rather than a database error', ({ assert }) => {
    const failure = describeTurnFailure(new ConcurrentTurnError(10))

    /**
     * Without this the unique constraint surfaces as a raw pg error in a 500,
     * which tells the caller nothing about what to do — and here the answer is
     * genuinely "wait", not "retry".
     */
    assert.equal(failure?.status, 409)
    assert.equal(failure?.code, 'turn_already_in_progress')
  })

  test('leaves an unrelated error to the framework', ({ assert }) => {
    assert.isNull(describeTurnFailure(new Error('something else')))
  })
})

async function user(id: string) {
  const { default: User } = await import('#models/user')

  return User.findOrFail(id)
}
