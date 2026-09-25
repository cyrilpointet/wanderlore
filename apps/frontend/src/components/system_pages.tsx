import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Wordmark } from '@/components/wordmark'

/**
 * The system pages (front spec, section 5.4): a short message and a way on.
 * Never a technical trace — the error itself only reaches the console.
 */

/** A route that does not exist. */
export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <SystemPage message={t('system.notFound')}>
      <Link to="/games" className={ACTION}>
        {t('system.backToGames')}
      </Link>
    </SystemPage>
  )
}

/** Anything that went wrong without a better place to say so. */
export function ErrorPage() {
  const { t } = useTranslation()

  return (
    <SystemPage message={t('system.unexpected')}>
      <button type="button" onClick={() => window.location.reload()} className={ACTION}>
        {t('system.reload')}
      </button>
    </SystemPage>
  )
}

const ACTION =
  'inline-flex h-10 items-center rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover'

function SystemPage({ message, children }: { message: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      <Wordmark />
      <p className="font-serif text-narration-lg text-text">{message}</p>
      {children}
    </main>
  )
}
