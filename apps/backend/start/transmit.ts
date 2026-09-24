/*
|--------------------------------------------------------------------------
| Transmit (SSE)
|--------------------------------------------------------------------------
|
| One channel per game, `sessions/:id`, which the front subscribes to when it
| opens the game screen — before any submission, so no event can leave before
| someone is listening.
|
*/

import transmit from '@adonisjs/transmit/services/main'

import Session from '#models/session'
import { middleware } from '#start/kernel'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Authenticated by the session cookie, like the rest of the API: `EventSource`
 * cannot carry an `Authorization` header, which is why the front moved to
 * cookies in the first place.
 */
transmit.registerRoutes((route) => {
  route.use(middleware.auth())
})

/**
 * A game's channel is open to its player only. Someone else's game reads as
 * one that does not exist, as on the read routes.
 */
transmit.authorize<{ id: string }>('sessions/:id', async (ctx, { id }) => {
  const user = ctx.auth.user

  /** A malformed id would otherwise reach PostgreSQL and fail there. */
  if (!user || !UUID.test(id)) {
    return false
  }

  const session = await Session.query().where('id', id).where('userId', user.id).first()

  return session !== null
})
