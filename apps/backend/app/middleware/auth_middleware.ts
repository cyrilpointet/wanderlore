import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

import { AccountSuspendedError, endSuspendedSession } from '#services/accounts'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    const user = await ctx.auth.authenticateUsing(options.guards)

    /** A session opened before the account was suspended ends here. */
    if (await endSuspendedSession(ctx, user)) {
      throw new AccountSuspendedError(401)
    }

    return next()
  }
}
