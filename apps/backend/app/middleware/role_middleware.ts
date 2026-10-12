import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import type User from '#models/user'
import { Refusal } from '#exceptions/refusal'

export type Role = User['role']

/**
 * Lets through the accounts of the roles given, after `auth`: a signed-in
 * account of another role is refused with a `403` the front can name.
 *
 * Three fixed roles, no permissions finer than that (roadmap, Phase 5bis).
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: Role[] }) {
    const user = ctx.auth.getUserOrFail()

    if (!options.roles.includes(user.role)) {
      throw new Refusal(403, 'forbidden_role', 'This account cannot do that.')
    }

    return next()
  }
}
