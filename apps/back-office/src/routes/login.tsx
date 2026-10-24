import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  canUseBackOffice,
  currentUserQuery,
  redirectTarget,
  signIn,
  signInErrorMessage,
  signOut,
} from '@/auth/session'
import { failureMessage } from '@/i18n/errors'
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
    // An account already signed in to the back-office has nothing to do here.
    const user = await context.queryClient.ensureQueryData(currentUserQuery)

    if (canUseBackOffice(user)) {
      throw redirect({ href: redirectTarget(search.redirect, user) })
    }
  },
  component: Login,
})

const FIELD =
  'h-11 w-full rounded-lg border border-border-strong bg-surface-1 px-3 text-body text-text transition-colors focus:border-accent focus:outline-none'

const BUTTON =
  'mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-body font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70'

function Login() {
  const { t } = useTranslation('auth')
  const { data: user } = useQuery(currentUserQuery)

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-90">
        <header className="mb-8 text-center">
          <h1>
            <Wordmark size="large" />
          </h1>
          <p className="mt-3 font-serif text-body text-muted">{t('tagline')}</p>
        </header>

        {/* Signed in from the player front, most likely: the cookie is shared. */}
        {user ? <WrongAccount /> : <SignInForm />}
      </div>
    </main>
  )
}

function SignInForm() {
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
      await navigate({ href: redirectTarget(search.redirect, user), replace: true })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    // The fields keep their values on failure: only the outcome is reset.
    signInMutation.mutate({ email, password })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-label font-medium text-muted">
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
        <label htmlFor="password" className="text-label font-medium text-muted">
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

      <button type="submit" disabled={signInMutation.isPending} className={BUTTON}>
        {signInMutation.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {signInMutation.isPending ? t('signingIn') : t('signIn')}
      </button>

      <div aria-live="polite" className="min-h-5">
        {signInMutation.error && (
          <p className="flex items-center justify-center gap-1.5 text-center text-label text-danger">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {signInErrorMessage(signInMutation.error)}
          </p>
        )}
      </div>
    </form>
  )
}

/** Signed in with a role the back-office is closed to: say so, and offer to switch accounts. */
function WrongAccount() {
  const { t } = useTranslation('auth')
  const queryClient = useQueryClient()

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(currentUserQuery.queryKey, null)
    },
  })

  return (
    <div className="flex flex-col gap-4 text-center">
      <p role="alert" className="text-body text-text">
        {t('closedToAccount')}
      </p>
      <button
        type="button"
        onClick={() => signOutMutation.mutate()}
        disabled={signOutMutation.isPending}
        className={BUTTON}
      >
        {t('signOutToSwitch')}
      </button>
      {signOutMutation.error && (
        <p className="text-label text-danger">{failureMessage(signOutMutation.error)}</p>
      )}
    </div>
  )
}
