import { describe, expect, test } from 'vitest'

import { ApiError, NetworkError } from '@/api/client'
import { describeSubmitFailure } from './use_turn'

describe('describeSubmitFailure', () => {
  test('no answer: the turn may exist, so the same key goes again', () => {
    expect(describeSubmitFailure(new NetworkError(new TypeError()))).toMatchObject({
      failure: { code: 'network_error' },
      retryWithSameKey: true,
    })
  })

  test('a server error reads as a lost connection, retried with the same key', () => {
    expect(describeSubmitFailure(new ApiError(502, undefined, 'Bad gateway', {}))).toMatchObject({
      failure: { code: 'network_error' },
      retryWithSameKey: true,
    })
  })

  test('a refused queue recorded the turn as failed: trying again is a new turn', () => {
    expect(
      describeSubmitFailure(new ApiError(503, 'turn_queue_unavailable', 'Try again.', {}))
    ).toMatchObject({ failure: { code: 'turn_queue_unavailable' }, retryWithSameKey: false })
  })

  test('a refusal keeps its own code', () => {
    expect(
      describeSubmitFailure(new ApiError(409, 'turn_already_in_progress', 'Wait.', {}))
    ).toMatchObject({ failure: { code: 'turn_already_in_progress' }, retryWithSameKey: false })
  })
})
