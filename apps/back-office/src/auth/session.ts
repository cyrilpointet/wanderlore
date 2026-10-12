import { queryOptions } from '@tanstack/react-query'

import { api, ApiError } from '@/api/client'
import { failureMessage } from '@/i18n/errors'
import i18n from '@/i18n'

export type Role = 'player' | 'game_master' | 'superadmin'

/** The signed-in account, as it reads itself: its role included. */
export type User = {
  id: string
  fullName: string | null
  email: string
  initials: string
  role: Role
}

/** Where a game master lands when nothing else was asked for. */
export const HOME = '/worlds'

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

/**
 * The back-office is for game masters. The backend refuses anyone else on
 * every request regardless: this only spares them a screen they cannot use.
 */
export function canUseBackOffice(user: User | null): user is User {
  return user?.role === 'game_master'
}

/** Signed in, but not as a game master: turned away right after signing in. */
export class NotAGameMasterError extends Error {
  constructor() {
    super('This account is not a game master.')
    this.name = 'NotAGameMasterError'
  }
}

/**
 * Signs in, then reads the account back to learn its role: a player is
 * signed out at once rather than left holding a session they cannot use here.
 */
export async function signIn(credentials: { email: string; password: string }): Promise<User> {
  await api('/auth/login', { method: 'POST', body: credentials })

  const user = await fetchCurrentUser()

  if (!canUseBackOffice(user)) {
    await signOut()
    throw new NotAGameMasterError()
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
  if (error instanceof NotAGameMasterError) {
    return i18n.t('notAGameMaster', { ns: 'auth' })
  }

  if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
    return i18n.t('invalidCredentials', { ns: 'auth' })
  }

  return failureMessage(error)
}

/**
 * The page to go back to after signing in. Only a path of this app is
 * followed: a crafted `?redirect=https://…` link must not send someone who
 * just typed their password to another site.
 */
export function redirectTarget(requested: string | undefined): string {
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return HOME
  if (requested.startsWith('/login')) return HOME
  return requested
}
