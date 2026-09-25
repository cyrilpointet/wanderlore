import { Transmit } from '@adonisjs/transmit-client'

import { csrfHeaders } from './client'

let instance: Transmit | null = null

/**
 * The one SSE connection of the app, opened on first use. Authenticated by
 * the session cookie like the API; subscribing is a `POST`, so it carries
 * the CSRF header too.
 */
export function transmit(): Transmit {
  instance ??= new Transmit({
    baseUrl: window.location.origin,
    beforeSubscribe: withCsrf,
    beforeUnsubscribe: withCsrf,
  })
  return instance
}

/** Closed when the player signs out or loses their session: the stream was opened as them. */
export function closeTransmit() {
  instance?.close()
  instance = null
}

function withCsrf(request: Request) {
  for (const [name, value] of Object.entries(csrfHeaders())) request.headers.set(name, value)
}
