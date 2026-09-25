import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AccountMenu } from '@/components/account_menu'
import { Wordmark } from '@/components/wordmark'

export const Route = createFileRoute('/_authenticated/games/')({
  component: Games,
})

function Games() {
  const { t } = useTranslation('games')

  return (
    <>
      <header className="border-b border-border bg-surface-1">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Wordmark />
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-serif text-[1.75rem] font-medium text-text">{t('title')}</h1>
      </main>
    </>
  )
}
