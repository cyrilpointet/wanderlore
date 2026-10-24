import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'

export const Route = createFileRoute('/_authenticated/accounts/')({
  component: Accounts,
})

/** The accounts, as a superadmin manages them. */
function Accounts() {
  const { t } = useTranslation('accounts')

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
        <h1 className="mb-8 font-serif text-[1.75rem] leading-tight font-medium text-text">
          {t('title')}
        </h1>
      </main>
    </>
  )
}
