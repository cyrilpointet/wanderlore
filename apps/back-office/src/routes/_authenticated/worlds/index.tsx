import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'
import { failureMessage } from '@/i18n/errors'
import { worldsQuery } from '@/worlds/queries'
import { WorldList } from '@/worlds/world_list'

export const Route = createFileRoute('/_authenticated/worlds/')({
  component: Worlds,
})

function Worlds() {
  const { t } = useTranslation('worlds')
  const worlds = useQuery(worldsQuery)

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
        <h1 className="mb-8 font-serif text-[1.75rem] leading-tight font-medium text-text">
          {t('title')}
        </h1>

        {worlds.isPending && (
          <p aria-busy className="text-body text-muted">
            {t('loading')}
          </p>
        )}

        {worlds.isError && (
          <div role="alert" className="rounded-lg border border-danger/60 p-5 text-body text-text">
            <p className="flex items-center gap-2">
              <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
              {failureMessage(worlds.error)}
            </p>
            <button
              type="button"
              onClick={() => worlds.refetch()}
              disabled={worlds.isFetching}
              className="mt-4 h-10 rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
            >
              {t('tryAgain', { ns: 'common' })}
            </button>
          </div>
        )}

        {worlds.isSuccess && <WorldList worlds={worlds.data} />}
      </main>
    </>
  )
}
