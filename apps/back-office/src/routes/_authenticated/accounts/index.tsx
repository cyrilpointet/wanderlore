import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AccountRow } from '@/accounts/account_row'
import { NewAccountForm } from '@/accounts/new_account_form'
import {
  ACCOUNT_STATUSES,
  type AccountFilters,
  type AccountRole,
  type AccountStatus,
  accountsQuery,
  reactivateAccount,
  ROLES,
  suspendAccount,
} from '@/accounts/queries'
import { currentUserQuery } from '@/auth/session'
import { AppHeader } from '@/components/app_header'
import { FormAlert } from '@/content/field'
import { formFailureOf } from '@/content/form_errors'
import { INPUT } from '@/content/ui'

export const Route = createFileRoute('/_authenticated/accounts/')({
  component: Accounts,
})

/** The accounts, as a superadmin manages them: listed, created, suspended, reactivated. */
function Accounts() {
  const { t } = useTranslation('accounts')
  const [filters, setFilters] = useState<AccountFilters>({})

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
        <h1 className="font-serif text-[1.75rem] leading-tight font-medium text-text">
          {t('title')}
        </h1>
        <p className="mt-2 mb-8 text-body text-muted">{t('intro')}</p>

        <div className="flex flex-col gap-8">
          <NewAccountForm />
          <section className="flex flex-col gap-4">
            <Filters filters={filters} onChange={setFilters} />
            <AccountList filters={filters} />
          </section>
        </div>
      </main>
    </>
  )
}

function Filters({
  filters,
  onChange,
}: {
  filters: AccountFilters
  onChange: (filters: AccountFilters) => void
}) {
  const { t } = useTranslation('accounts')

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">{t('filters.label')}</legend>
      <label className="flex flex-col gap-1.5 text-label font-medium text-muted">
        {t('filters.role')}
        <select
          value={filters.role ?? ''}
          onChange={(event) =>
            onChange({ ...filters, role: (event.target.value || undefined) as AccountRole })
          }
          className={INPUT}
        >
          <option value="">{t('filters.all')}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-label font-medium text-muted">
        {t('filters.status')}
        <select
          value={filters.status ?? ''}
          onChange={(event) =>
            onChange({ ...filters, status: (event.target.value || undefined) as AccountStatus })
          }
          className={INPUT}
        >
          <option value="">{t('filters.all')}</option>
          {ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

function AccountList({ filters }: { filters: AccountFilters }) {
  const { t } = useTranslation('accounts')
  const queryClient = useQueryClient()
  const accounts = useQuery(accountsQuery(filters))
  const { data: me } = useQuery(currentUserQuery)
  const [refusals, setRefusals] = useState<Record<string, string>>({})

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'reactivate' }) =>
      action === 'suspend' ? suspendAccount(id) : reactivateAccount(id),
    onMutate: ({ id }) =>
      setRefusals((current) => {
        const next = { ...current }
        delete next[id]
        return next
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    onError: (error, { id }) =>
      setRefusals((current) => ({ ...current, [id]: formFailureOf(error).general ?? '' })),
  })

  const suspend = (id: string) => act.mutate({ id, action: 'suspend' })
  const reactivate = (id: string) => act.mutate({ id, action: 'reactivate' })

  if (accounts.isPending) {
    return <p className="text-body text-muted">{t('loading')}</p>
  }

  if (accounts.isError) {
    return <FormAlert message={formFailureOf(accounts.error).general ?? ''} />
  }

  if (accounts.data.length === 0) {
    return <p className="text-body text-muted">{t('empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {accounts.data.map((account) => (
        <li key={account.id}>
          <AccountRow
            account={account}
            isSelf={account.id === me?.id}
            pending={act.isPending && act.variables?.id === account.id}
            error={refusals[account.id]}
            onSuspend={() => suspend(account.id)}
            onReactivate={() => reactivate(account.id)}
          />
        </li>
      ))}
    </ul>
  )
}
