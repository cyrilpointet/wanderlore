import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, Outlet } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { AppHeader } from '@/components/app_header'
import { worldQuery } from '@/worlds/queries'

export const Route = createFileRoute('/_authenticated/worlds/$worldId')({
  loader: async ({ context: { queryClient }, params: { worldId } }) => {
    try {
      await queryClient.ensureQueryData(worldQuery(worldId))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: WorldLayout,
})

const TAB = 'border-b-2 border-transparent px-1 pb-2 text-label text-muted transition-colors hover:text-text'
const ACTIVE_TAB = { className: 'border-accent text-text' }
const EXACT = { exact: true }

/** A world's editor: its name above, the parts of the world as tabs. */
function WorldLayout() {
  const { t } = useTranslation('worlds')
  const { worldId } = Route.useParams()
  const { data: world } = useSuspenseQuery(worldQuery(worldId))

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
        <Link
          to="/worlds"
          className="mb-6 inline-flex items-center gap-1.5 text-label text-muted transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <h1 className="font-serif text-[1.75rem] leading-tight font-medium text-text">
          {world.labels.en}
        </h1>
        <p className="mt-1 font-mono text-label text-subtle">{world.reference}</p>

        <nav aria-label={t('tabs.label')} className="mt-6 mb-8 flex gap-5 overflow-x-auto border-b border-border">
          <Link
            to="/worlds/$worldId"
            params={{ worldId }}
            activeOptions={EXACT}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.general')}
          </Link>
          <Link
            to="/worlds/$worldId/action-types"
            params={{ worldId }}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.actionTypes')}
          </Link>
          <Link to="/worlds/$worldId/npcs" params={{ worldId }} activeProps={ACTIVE_TAB} className={TAB}>
            {t('tabs.npcs')}
          </Link>
          <Link
            to="/worlds/$worldId/locations"
            params={{ worldId }}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.locations')}
          </Link>
          <Link to="/worlds/$worldId/items" params={{ worldId }} activeProps={ACTIVE_TAB} className={TAB}>
            {t('tabs.items')}
          </Link>
          <Link
            to="/worlds/$worldId/scenarios"
            params={{ worldId }}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.scenarios')}
          </Link>
        </nav>

        <Outlet />
      </main>
    </>
  )
}
