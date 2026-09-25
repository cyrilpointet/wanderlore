import { queryOptions } from '@tanstack/react-query'

import { api, ApiError } from '@/api/client'
import { failureMessage } from '@/i18n/errors'
import i18n from '@/i18n'

export type User = {
  id: string
  fullName: string | null
  email: string
  initials: string
}

/** Where a signed-in player lands when nothing else was asked for. */
export const HOME = '/games'

/**
 * Who is signed in, or `null`. Only sign-in, sign-out and a 401 change it,
 * so it never goes stale on its own.
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

export async function signIn(credentials: { email: string; password: string }): Promise<User> {
  const { data } = await api<{ data: User }>('/auth/login', {
    method: 'POST',
    body: credentials,
  })
  return data
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
  if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
    return i18n.t('invalidCredentials', { ns: 'auth' })
  }

  return failureMessage(error)
}

/**
 * The page to go back to after signing in. Only a path of this app is
 * followed: a crafted `?redirect=https://…` link must not send a player
 * who just typed their password to another site.
 */
export function redirectTarget(requested: string | undefined): string {
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return HOME
  if (requested.startsWith('/login')) return HOME
  return requested
}
