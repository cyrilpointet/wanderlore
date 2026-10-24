import { queryOptions } from '@tanstack/react-query'

import { api, ApiError } from '@/api/client'
import { failureMessage } from '@/i18n/errors'
import i18n from '@/i18n'
import { canVisit, homeOf, isBackOfficeRole } from './sections'

export type Role = 'player' | 'game_master' | 'superadmin'

/** The signed-in account, as it reads itself: its role included. */
export type User = {
  id: string
  fullName: string | null
  email: string
  initials: string
  role: Role
}

/**
 * Who is signed in, or `null` — a player as well: the session cookie is the
 * front's too, so a player may well arrive here signed in. Only sign-in,
 * sign-out and a 401 change it.
 *
 * Asked on every route, `/login` included: its answer also sets the CSRF
 * cookie the sign-in form needs.
 */
export const currentUserQuery = queryOptions({
  queryKey: ['currentUser'],
  queryFn: fetchCurrentUser,
  staleTime: Infinity,
})

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api<{ data: User }>('/account/profile', {
      redirectOnUnauthorized: false,
    })
    return data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** A signed-in account the back-office is open to: a game master or a superadmin. */
export type BackOfficeUser = User & { role: 'game_master' | 'superadmin' }

/**
 * The back-office is for game masters and superadmins, each in their own
 * sections. The backend refuses anyone else on every request regardless:
 * this only spares them screens they cannot use.
 */
export function canUseBackOffice(user: User | null): user is BackOfficeUser {
  return user !== null && isBackOfficeRole(user.role)
}

/** Signed in, but with a role the back-office is closed to: turned away right after signing in. */
export class ClosedToAccountError extends Error {
  constructor() {
    super('The back-office is closed to this account.')
    this.name = 'ClosedToAccountError'
  }
}

/**
 * Signs in, then reads the account back to learn its role: a player is
 * signed out at once rather than left holding a session they cannot use here.
 */
export async function signIn(credentials: {
  email: string
  password: string
}): Promise<BackOfficeUser> {
  await api('/auth/login', { method: 'POST', body: credentials })

  const user = await fetchCurrentUser()

  if (!canUseBackOffice(user)) {
    await signOut()
    throw new ClosedToAccountError()
  }

  return user
}

export async function signOut(): Promise<void> {
  await api('/account/logout', { method: 'POST' })
}

/**
 * What the sign-in form says when it fails. Refused credentials (400) and a
 * malformed email (422) read the same: telling them apart would only help
 * someone probing for accounts.
 */
export function signInErrorMessage(error: unknown): string {
  if (error instanceof ClosedToAccountError) {
    return i18n.t('closedToAccount', { ns: 'auth' })
  }

  if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
    return i18n.t('invalidCredentials', { ns: 'auth' })
  }

  return failureMessage(error)
}

/**
 * The page to go back to after signing in. Only a path of this app is
 * followed — a crafted `?redirect=https://…` link must not send someone who
 * just typed their password to another site — and only a path of the
 * account's own sections; anything else lands on its home.
 */
export function redirectTarget(requested: string | undefined, user: BackOfficeUser): string {
  const home = homeOf(user.role)

  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return home
  if (requested.startsWith('/login') || requested === '/') return home

  const pathname = requested.split(/[?#]/)[0]!
  return canVisit(user.role, pathname) ? requested : home
}
