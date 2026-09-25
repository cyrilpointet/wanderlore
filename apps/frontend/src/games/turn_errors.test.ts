import { describe, expect, test } from 'vitest'

import { ApiError, NetworkError } from '@/api/client'
import { errorMessage } from '@/i18n/errors'
import { classifySubmitError, emphasisOf } from './turn_errors'

/**
 * The error table of the front spec (section 5.3.6), row by row: where each
 * failure shows, what the player can do, and the words they read.
 */
describe('turn errors — failures of a turn being played (turn_failed)', () => {
  test.each([
    ['llm_timeout', 'retry', 'The game master took too long to answer. Try your action again.'],
    ['llm_unreachable', 'retry', 'The game master could not be reached. Try again in a moment.'],
    ['llm_http_error', 'retry', 'The game master refused the request.'],
    [
      'llm_invalid_output',
      'edit',
      'The game master answered something unusable. Try rephrasing your action.',
    ],
    [
      'turn_validation_failed',
      'retry',
      'The game master proposed something the rules do not allow. Nothing was applied.',
    ],
    ['turn_expired', 'retry', 'The game master never finished this turn. Try your action again.'],
  ])('%s puts %s forward and reads in the player’s words', (code, emphasis, text) => {
    expect(emphasisOf(code)).toBe(emphasis)
    expect(errorMessage({ code, message: 'raw English from the API' })).toBe(text)
  })

  test('a code the front does not know yet falls back on the API message', () => {
    expect(emphasisOf('brand_new_code')).toBe('retry')
    expect(errorMessage({ code: 'brand_new_code', message: 'From the API.' })).toBe('From the API.')
  })

  test('and on a generic message when the API sent none', () => {
    expect(errorMessage({ code: 'brand_new_code', message: '' })).toBe('Something went wrong.')
  })
})

describe('turn errors — failures of the submission (the POST)', () => {
  test('503 turn_queue_unavailable: a card, retried as a new turn', () => {
    expect(
      classifySubmitError(new ApiError(503, 'turn_queue_unavailable', 'Try again.', {}))
    ).toEqual({
      kind: 'card',
      failure: { code: 'turn_queue_unavailable', message: 'Try again.' },
      retryWithSameKey: false,
    })
  })

  test('409 turn_already_in_progress: no card, wait for the turn in progress', () => {
    expect(classifySubmitError(new ApiError(409, 'turn_already_in_progress', 'Wait.', {}))).toEqual(
      { kind: 'wait' }
    )
  })

  test.each([
    ['maxLength', 'input_too_long', 'Your action is too long. Shorten it and send it again.'],
    ['minLength', 'input_empty', 'Write what you do first.'],
    ['required', 'input_empty', 'Write what you do first.'],
    ['uuid', 'input_invalid', 'This action cannot be sent as it is.'],
  ])('422 from the validator (%s): under the field, as %s', (rule, code, text) => {
    const outcome = classifySubmitError(
      new ApiError(422, undefined, 'raw', {
        errors: [{ rule, field: 'playerInput', message: 'raw' }],
      })
    )

    expect(outcome).toMatchObject({ kind: 'field', failure: { code } })
    expect(outcome.kind === 'field' && errorMessage(outcome.failure)).toBe(text)
  })

  test('401: left to the sign-in redirect, nothing shown here', () => {
    expect(classifySubmitError(new ApiError(401, undefined, 'Unauthorized', {}))).toEqual({
      kind: 'signed_out',
    })
  })

  test('no answer: "Connection lost.", retried with the same key', () => {
    const outcome = classifySubmitError(new NetworkError(new TypeError()))

    expect(outcome).toMatchObject({ kind: 'card', retryWithSameKey: true })
    expect(outcome.kind === 'card' && errorMessage(outcome.failure)).toBe('Connection lost.')
  })

  test('another 5xx: "Connection lost.", retried with the same key', () => {
    const outcome = classifySubmitError(new ApiError(502, undefined, 'Bad gateway', {}))

    expect(outcome).toMatchObject({ kind: 'card', retryWithSameKey: true })
    expect(outcome.kind === 'card' && errorMessage(outcome.failure)).toBe('Connection lost.')
  })

  test('a coded refusal from the pipeline stays a card with its own words', () => {
    expect(
      classifySubmitError(new ApiError(422, 'turn_validation_failed', 'Refused.', {}))
    ).toMatchObject({ kind: 'card', failure: { code: 'turn_validation_failed' } })
  })

  test('anything else thrown: a generic card', () => {
    const outcome = classifySubmitError(new Error('boom'))

    expect(outcome).toMatchObject({ kind: 'card', retryWithSameKey: false })
    expect(outcome.kind === 'card' && errorMessage(outcome.failure)).toBe('Something went wrong.')
  })
})
