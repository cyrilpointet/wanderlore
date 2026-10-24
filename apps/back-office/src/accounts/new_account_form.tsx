import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Field, FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { INPUT, PRIMARY, SECTION } from '@/content/ui'
import { accountPayloadOf, emptyAccountDraft, type AccountDraft } from './account_draft'
import { createAccount, ROLES } from './queries'

/** A new account of any role, active at once, with the password the superadmin gives. */
export function NewAccountForm() {
  const { t } = useTranslation('accounts')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(emptyAccountDraft)
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const [created, setCreated] = useState(false)

  const set =
    <Key extends keyof AccountDraft>(key: Key) =>
    (value: AccountDraft[Key]) => {
      setDraft((current) => ({ ...current, [key]: value }))
      setCreated(false)
    }
  const on = {
    fullName: set('fullName'),
    email: set('email'),
    password: set('password'),
    role: set('role'),
  }

  const create = useMutation({
    mutationFn: () => createAccount(accountPayloadOf(draft)),
    onMutate: () => {
      setFailure(null)
      setCreated(false)
    },
    onSuccess: async () => {
      setDraft(emptyAccountDraft())
      setCreated(true)
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  const errors = failure?.fields ?? {}

  return (
    <form onSubmit={submit} className={`${SECTION} flex flex-col gap-4`}>
      <h2 className="font-serif text-[1.25rem] text-text">{t('newAccount')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="account-name" label={t('form.fullName')} error={errors.fullName}>
          <input
            id="account-name"
            value={draft.fullName}
            autoComplete="off"
            onChange={(event) => on.fullName(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field id="account-email" label={t('form.email')} error={errors.email}>
          <input
            id="account-email"
            type="email"
            value={draft.email}
            autoComplete="off"
            onChange={(event) => on.email(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field
          id="account-password"
          label={t('form.password')}
          hint={t('form.passwordHint')}
          error={errors.password}
        >
          <input
            id="account-password"
            type="password"
            value={draft.password}
            autoComplete="new-password"
            onChange={(event) => on.password(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field id="account-role" label={t('form.role')} error={errors.role}>
          <select
            id="account-role"
            value={draft.role}
            onChange={(event) => on.role(event.target.value as AccountDraft['role'])}
            className={INPUT}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {failure?.general && <FormAlert message={failure.general} />}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={create.isPending} className={PRIMARY}>
          {create.isPending ? t('creating') : t('create')}
        </button>
        {created && (
          <span role="status" className="flex items-center gap-1.5 text-label text-success">
            <CircleCheck aria-hidden className="size-4" />
            {t('created')}
          </span>
        )}
      </div>
    </form>
  )
}
