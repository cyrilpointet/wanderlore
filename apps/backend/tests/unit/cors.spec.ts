import { test } from '@japa/runner'

import { allowedOrigins } from '#config/cors'

test.group('CORS origins', () => {
  test('reads the origins of both apps from one variable', ({ assert }) => {
    assert.deepEqual(allowedOrigins('https://app.example.com, https://admin.example.com'), [
      'https://app.example.com',
      'https://admin.example.com',
    ])
  })

  test('allows no origin when none is declared', ({ assert }) => {
    assert.deepEqual(allowedOrigins(undefined), [])
    assert.deepEqual(allowedOrigins(' , '), [])
  })
})
