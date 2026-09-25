/**
 * The one way the front talks to the API.
 *
 * Authentication is the session cookie, sent by the browser on its own: no
 * token is ever stored front-side. Mutating requests echo the CSRF token that
 * `@adonisjs/shield` exposes in the `XSRF-TOKEN` cookie.
 */
const BASE_URL = '/api/v1'
const CSRF_COOKIE = 'XSRF-TOKEN'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** A response the API refused. `code` is set when the API sent one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    readonly body: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** The request never got an answer. Named like an API code, so it translates the same way. */
export class NetworkError extends Error {
  readonly code = 'network_error'

  constructor(cause: unknown) {
    super('The request did not reach the server.', { cause })
    this.name = 'NetworkError'
  }
}

let unauthorizedHandler: () => void = () => {}

/**
 * What to do when the session is missing or expired. Set once by the app,
 * which knows the router — this module does not.
 */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

/**
 * The CSRF header for a mutating request. Exported for the Transmit client,
 * whose subscription is a `POST` too.
 */
export function csrfHeaders(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE)
  return token ? { 'X-XSRF-TOKEN': token } : {}
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(MUTATING_METHODS.has(method) ? csrfHeaders() : {}),
    ...options.headers,
  }

  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    // An abort is the caller's decision, not a network failure.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new NetworkError(error)
  }

  const body = await readBody(response)

  if (response.ok) return body as T

  if (response.status === 401) unauthorizedHandler()

  throw toApiError(response.status, body)
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * The API answers in two shapes: `{ error: { code, message } }` for the
 * project's own failures, and `{ errors: [{ message }] }` for the framework's
 * (validation, authentication).
 */
function toApiError(status: number, body: unknown): ApiError {
  if (isRecord(body)) {
    if (isRecord(body.error)) {
      const { code, message } = body.error
      return new ApiError(
        status,
        typeof code === 'string' ? code : undefined,
        typeof message === 'string' ? message : `HTTP ${status}`,
        body
      )
    }

    if (Array.isArray(body.errors) && isRecord(body.errors[0])) {
      const { message } = body.errors[0]
      return new ApiError(
        status,
        undefined,
        typeof message === 'string' ? message : `HTTP ${status}`,
        body
      )
    }
  }

  return new ApiError(status, undefined, `HTTP ${status}`, body)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined
}
