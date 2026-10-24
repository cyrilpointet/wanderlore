import type { HttpContext } from '@adonisjs/core/http'

import User from '#models/user'
import { Refusal } from '#exceptions/refusal'

/**
 * The refusal a suspended account meets: at sign-in (`403`, the credentials
 * were right but the account may not be used), and on any request made with
 * a session opened before the suspension (`401`, the session is over).
 */
export class AccountSuspendedError extends Refusal {
  constructor(status: 401 | 403) {
    super(status, 'account_suspended', 'This account is suspended.')
  }
}

/**
 * Ends the session of a suspended account. The session lives in an encrypted
 * cookie, which cannot be revoked server-side: the account is read again on
 * every request instead, and its session closed the first time it shows up
 * suspended.
 */
export async function endSuspendedSession(ctx: HttpContext, user: User): Promise<boolean> {
  if (!user.isSuspended) {
    return false
  }

  await ctx.auth.use('web').logout()

  return true
}

export type NewAccount = {
  fullName: string
  email: string
  password: string
  role: User['role']
}

/**
 * Creates an account of any role, active, with the password given: no email
 * is sent before Phase 9 — whoever creates it hands the password over.
 * Expects input already validated by `createAccountValidator`.
 */
export async function createAccount(account: NewAccount): Promise<User> {
  return User.create({ ...account, suspendedAt: null })
}
