import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FieldError } from '@/content/field'
import { DANGER, SECONDARY } from '@/content/ui'
import type { Account } from './queries'

const DATE = { value: { dateStyle: 'medium' } }

/**
 * One account: who, what role, whether it is suspended, and the one action
 * that applies — suspend, confirmed first, or reactivate. One's own account
 * offers none: an account never suspends itself.
 */
export function AccountRow({
  account,
  isSelf,
  pending,
  error,
  onSuspend,
  onReactivate,
}: {
  account: Account
  isSelf: boolean
  pending: boolean
  /** Why the last action on this account was refused, if it was. */
  error?: string
  onSuspend: () => void
  onReactivate: () => void
}) {
  const { t } = useTranslation('accounts')
  const [confirming, setConfirming] = useState(false)
  const suspended = account.status === 'suspended'

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-1 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-text">
            {account.fullName ?? account.email}
            {isSelf && <span className="ml-2 text-label text-subtle">{t('you')}</span>}
          </p>
          <p className="truncate text-label text-muted">{account.email}</p>
          <p className="mt-1 text-label text-subtle">
            {suspended && account.suspendedAt
              ? t('suspendedOn', { value: new Date(account.suspendedAt), formatParams: DATE })
              : t('createdOn', { value: new Date(account.createdAt), formatParams: DATE })}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Badge>{t(`roles.${account.role}`)}</Badge>
          <Badge danger={suspended}>{t(`statuses.${account.status}`)}</Badge>
        </div>
      </div>

      {!isSelf && (
        <div className="flex flex-col gap-2">
          {suspended ? (
            <div>
              <button type="button" onClick={onReactivate} disabled={pending} className={SECONDARY}>
                {pending ? t('reactivating') : t('reactivate')}
              </button>
            </div>
          ) : confirming ? (
            <>
              <p className="text-label text-muted">{t('suspendHint')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false)
                    onSuspend()
                  }}
                  className={DANGER}
                >
                  {t('confirmSuspend')}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={SECONDARY}>
                  {t('cancel', { ns: 'content' })}
                </button>
              </div>
            </>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={pending}
                className={DANGER}
              >
                {pending ? t('suspending') : t('suspend')}
              </button>
            </div>
          )}
          {error && <FieldError message={error} />}
        </div>
      )}
    </div>
  )
}

function Badge({ children, danger = false }: { children: string; danger?: boolean }) {
  const colours = danger
    ? 'border-danger/60 bg-danger/10 text-danger'
    : 'border-border-strong bg-surface-2 text-muted'

  return (
    <span className={`rounded-sm border px-2 py-0.5 text-meta uppercase ${colours}`}>{children}</span>
  )
}
