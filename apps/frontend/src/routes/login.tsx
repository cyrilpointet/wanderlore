import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { currentUserQuery, redirectTarget, signIn, signInErrorMessage } from '@/auth/session'
import { PRIMARY_ACTION } from '@/components/actions'
import { D10 } from '@/components/dice'
import { RulesCredit } from '@/components/rules_credit'
import { CARD } from '@/components/surfaces'
import { Wordmark } from '@/components/wordmark'

type LoginSearch = {
  /** Where to go back to once signed in. */
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    // Already signed in: nothing to do here.
    if (await context.queryClient.ensureQueryData(currentUserQuery)) {
      throw redirect({ href: redirectTarget(search.redirect) })
    }
  },
  component: Login,
})

const FIELD =
  'h-11 w-full rounded-md border border-border-strong bg-paper px-3 text-body text-text shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-colors focus:border-accent focus:outline-none'

const FIELD_LABEL = 'text-[0.78125rem] leading-none font-semibold text-muted'

function Login() {
  const { t } = useTranslation('auth')
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: async (user) => {
      queryClient.setQueryData(currentUserQuery.queryKey, user)
      await navigate({ href: redirectTarget(search.redirect), replace: true })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    // The fields keep their values on failure: only the outcome is reset.
    signInMutation.mutate({ email, password })
  }

  return (
    <main className="px-4 pt-[6vh] pb-10">
      <div className="relative mx-auto flex w-full max-w-100 flex-col gap-[22px]">
        {/* Two dice left lying on the table, from a wide screen up. Decoration only. */}
        <span className="absolute top-[120px] -left-[150px] hidden -rotate-[14deg] leading-none lg:block">
          <D10 face={7} size="small" />
        </span>
        <span className="absolute top-[330px] -right-[130px] hidden rotate-[18deg] leading-none lg:block">
          <D10 face={30} size="small" />
        </span>

        <header className="flex flex-col items-center gap-3 text-center">
          <h1>
            <Wordmark size="large" />
          </h1>
          <p className="font-serif text-[0.96875rem] leading-relaxed text-muted italic">
            {t('tagline')}
          </p>
        </header>

        <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-[22px]`}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={FIELD_LABEL}>
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={FIELD_LABEL}>
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={FIELD}
            />
          </div>

          <button
            type="submit"
            disabled={signInMutation.isPending}
            className={`${PRIMARY_ACTION} w-full disabled:cursor-wait`}
          >
            {signInMutation.isPending && (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            )}
            {signInMutation.isPending ? t('signingIn') : t('signIn')}
          </button>

          {/* Pulled into the gap while empty, so the card keeps its padding. */}
          <div aria-live="polite" className="-mt-4">
            {signInMutation.error && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-label text-danger">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                {signInErrorMessage(signInMutation.error)}
              </p>
            )}
          </div>
        </form>
        <RulesCredit />
      </div>
    </main>
  )
}
