import { DateTime } from 'luxon'
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

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

/** The accounts, newest first, narrowed to a role or a status when asked. */
export async function listAccounts(filters: {
  role?: User['role']
  status?: AccountStatus
}): Promise<User[]> {
  const query = User.query().orderBy('createdAt', 'desc').orderBy('email', 'asc')

  if (filters.role) query.where('role', filters.role)
  if (filters.status === 'active') query.whereNull('suspendedAt')
  if (filters.status === 'suspended') query.whereNotNull('suspendedAt')

  return query
}

/**
 * Suspends an account. Never one's own — a superadmin would lock themselves
 * out — and never the last active superadmin, or nobody could manage
 * accounts any more. Suspending an account already suspended keeps the date
 * it was first suspended on.
 */
export async function suspendAccount(actor: User, target: User): Promise<User> {
  if (actor.id === target.id) {
    throw new Refusal(409, 'cannot_suspend_self', 'An account cannot suspend itself.')
  }

  if (target.isSuspended) {
    return target
  }

  if (target.role === 'superadmin') {
    const others = await User.query()
      .where('role', 'superadmin')
      .whereNull('suspendedAt')
      .whereNot('id', target.id)
      .first()

    if (others === null) {
      throw new Refusal(409, 'last_superadmin', 'The last active superadmin cannot be suspended.')
    }
  }

  target.suspendedAt = DateTime.now()
  await target.save()

  return target
}

export async function reactivateAccount(target: User): Promise<User> {
  target.suspendedAt = null
  await target.save()

  return target
}
