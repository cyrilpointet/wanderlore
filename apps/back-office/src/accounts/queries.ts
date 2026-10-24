import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'

/** The fixed roles of an account; no custom role, no partial delegation. */
export const ROLES = ['player', 'game_master', 'superadmin'] as const
export type AccountRole = (typeof ROLES)[number]

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

/** An account as the superadmin manages it. Shape mirrors the backend transformer. */
export type Account = {
  id: string
  fullName: string | null
  email: string
  role: AccountRole
  status: AccountStatus
  suspendedAt: string | null
  createdAt: string
}

export type AccountFilters = { role?: AccountRole; status?: AccountStatus }

export type NewAccount = {
  fullName: string
  email: string
  password: string
  role: AccountRole
}

function queryOf(filters: AccountFilters): string {
  const params = new URLSearchParams()
  if (filters.role) params.set('role', filters.role)
  if (filters.status) params.set('status', filters.status)

  const query = params.toString()
  return query === '' ? '' : `?${query}`
}

/** The accounts, newest first, narrowed as asked — the backend filters and sorts. */
export const accountsQuery = (filters: AccountFilters) =>
  queryOptions({
    queryKey: ['accounts', filters.role ?? null, filters.status ?? null],
    queryFn: async () =>
      (await api<{ data: Account[] }>(`/admin/accounts${queryOf(filters)}`)).data,
  })

export async function createAccount(account: NewAccount): Promise<Account> {
  return (await api<{ data: Account }>('/admin/accounts', { method: 'POST', body: account })).data
}

export async function suspendAccount(id: string): Promise<Account> {
  return (await api<{ data: Account }>(`/admin/accounts/${id}/suspend`, { method: 'POST' })).data
}

export async function reactivateAccount(id: string): Promise<Account> {
  return (await api<{ data: Account }>(`/admin/accounts/${id}/reactivate`, { method: 'POST' }))
    .data
}
