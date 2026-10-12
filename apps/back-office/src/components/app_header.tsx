import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AccountMenu } from '@/components/account_menu'
import { Wordmark } from '@/components/wordmark'

/** The section the page belongs to; the router marks its link `aria-current` itself. */
const ACTIVE_SECTION = { className: 'text-text' }

/** The header of every page: the wordmark, the sections of the back-office, the account menu. */
export function AppHeader() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface-1">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-6">
          <Link to="/worlds" className="flex items-baseline gap-2">
            <Wordmark />
            <span className="text-meta text-subtle uppercase">{t('backOffice')}</span>
          </Link>
          <nav aria-label={t('nav.label')}>
            <Link
              to="/worlds"
              className="text-label text-muted transition-colors hover:text-text"
              activeProps={ACTIVE_SECTION}
            >
              {t('nav.worlds')}
            </Link>
          </nav>
        </div>
        <AccountMenu />
      </div>
    </header>
  )
}
