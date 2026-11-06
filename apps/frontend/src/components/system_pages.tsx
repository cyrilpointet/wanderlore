import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION } from './actions'
import { AppHeader } from './app_header'
import { D10 } from './dice'
import { PAGE } from './layout'
import { RulesCredit } from './rules_credit'
import { CARD } from './surfaces'

/**
 * The system pages (front spec, section 5.4): a single card on the table, a
 * short message and a way on. Never a technical trace — the error itself only
 * reaches the console.
 */

/** A route that does not exist. */
export function NotFoundPage() {
  const { t } = useTranslation()

  return <NotFoundMessage message={t('system.notFound')} />
}

/**
 * Something that does not exist — a route, or a character or a game that is
 * not the player's — worded by the caller. Two d10 on 00 and 0, the worst
 * roll there is: decoration only.
 */
export function NotFoundMessage({ message }: { message: string }) {
  const { t } = useTranslation()

  return (
    <SystemPage
      message={message}
      dice={
        // A line as tall as the faces, which the dice clip to their top face.
        <div className="flex gap-2.5 leading-none">
          <D10 face={'00'} size="small" />
          <D10 face={0} size="small" />
        </div>
      }
    >
      <Link to="/" className={PRIMARY_ACTION}>
        {t('system.backHome')}
      </Link>
    </SystemPage>
  )
}

/** Anything that went wrong without a better place to say so. */
export function ErrorPage() {
  const { t } = useTranslation()

  return (
    <SystemPage message={t('system.unexpected')}>
      <button type="button" onClick={() => window.location.reload()} className={PRIMARY_ACTION}>
        <RotateCw aria-hidden className="size-4" />
        {t('system.reload')}
      </button>
    </SystemPage>
  )
}

function SystemPage({
  message,
  dice,
  children,
}: {
  message: string
  dice?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className={`${PAGE} flex flex-1 flex-col gap-[26px] pt-[26px] pb-12 lg:gap-9`}>
        <div
          className={`${CARD} m-auto flex w-full max-w-110 flex-col items-center gap-4 px-6 pt-7 pb-6 text-center`}
        >
          {dice}
          <h1 className="font-serif text-xl leading-tight font-semibold text-balance text-text">
            {message}
          </h1>
          {children}
        </div>
        <RulesCredit />
      </main>
    </div>
  )
}
