import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, ApiError, NetworkError, onUnauthorized } from './client'

function respond(status: number, body?: unknown) {
  return vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  return fetchMock.mock.calls[0]![1].headers
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: 'adonis-session=s; XSRF-TOKEN=abc%3D%3D' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    onUnauthorized(() => {})
  })

  test('prefixes the API path and returns the parsed body', async () => {
    const fetchMock = respond(200, { id: 'game' })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/sessions')).resolves.toEqual({ id: 'game' })
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/sessions')
  })

  test('echoes the decoded CSRF cookie on a mutating request', async () => {
    const fetchMock = respond(202, {})
    vi.stubGlobal('fetch', fetchMock)

    await api('/sessions/1/turns', { method: 'POST', body: { input: 'Draw' } })

    expect(sentHeaders(fetchMock)['X-XSRF-TOKEN']).toBe('abc==')
    expect(sentHeaders(fetchMock)['Content-Type']).toBe('application/json')
  })

  test('sends no CSRF header on a read', async () => {
    const fetchMock = respond(200, [])
    vi.stubGlobal('fetch', fetchMock)

    await api('/sessions')

    expect(sentHeaders(fetchMock)).not.toHaveProperty('X-XSRF-TOKEN')
  })

  test('hands a 401 to the unauthorized handler, then throws', async () => {
    vi.stubGlobal('fetch', respond(401, { errors: [{ message: 'Unauthorized access' }] }))
    const handler = vi.fn()
    onUnauthorized(handler)

    await expect(api('/account/profile')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledOnce()
  })

  test("reads the code of the project's own failures", async () => {
    vi.stubGlobal(
      'fetch',
      respond(503, { error: { code: 'turn_queue_unavailable', message: 'Try again.' } })
    )

    const error = await api('/sessions/1/turns', { method: 'POST' }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 503,
      code: 'turn_queue_unavailable',
      message: 'Try again.',
    })
  })

  test("keeps the framework's first message when there is no code", async () => {
    vi.stubGlobal('fetch', respond(422, { errors: [{ message: 'Too long', field: 'input' }] }))

    await expect(api('/sessions/1/turns', { method: 'POST' })).rejects.toMatchObject({
      status: 422,
      code: undefined,
      message: 'Too long',
    })
  })

  test('leaves an expected 401 to the caller', async () => {
    vi.stubGlobal('fetch', respond(401, { errors: [{ message: 'Unauthorized access' }] }))
    const handler = vi.fn()
    onUnauthorized(handler)

    await expect(api('/account/profile', { redirectOnUnauthorized: false })).rejects.toMatchObject({
      status: 401,
    })
    expect(handler).not.toHaveBeenCalled()
  })

  test('sends once more with the fresh token when shield refused the CSRF token', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => {
        // Shield sets a fresh cookie before refusing.
        vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=fresh' })
        return new Response(JSON.stringify({ error: { code: 'invalid_csrf_token' } }), {
          status: 403,
        })
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/auth/login', { method: 'POST', body: {} })).resolves.toEqual({ data: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![1].headers['X-XSRF-TOKEN']).toBe('fresh')
  })

  test('sends only once more', async () => {
    const refused = () =>
      new Response(JSON.stringify({ error: { code: 'invalid_csrf_token' } }), { status: 403 })
    const fetchMock = vi.fn().mockImplementation(async () => refused())
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/auth/login', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('turns a failed fetch into a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api('/sessions')).rejects.toBeInstanceOf(NetworkError)
  })

  test('lets an abort through untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))

    await expect(api('/sessions')).rejects.toBe(abort)
  })
})
