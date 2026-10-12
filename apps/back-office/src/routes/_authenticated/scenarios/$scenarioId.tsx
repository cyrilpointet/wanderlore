import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, Outlet } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { AppHeader } from '@/components/app_header'
import { scenarioQuery } from '@/scenarios/queries'
import { worldQuery } from '@/worlds/queries'

export const Route = createFileRoute('/_authenticated/scenarios/$scenarioId')({
  loader: async ({ context: { queryClient }, params: { scenarioId } }) => {
    try {
      const scenario = await queryClient.ensureQueryData(scenarioQuery(scenarioId))
      await queryClient.ensureQueryData(worldQuery(scenario.worldId))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: ScenarioLayout,
})

const TAB = 'border-b-2 border-transparent px-1 pb-2 text-label text-muted transition-colors hover:text-text'
const ACTIVE_TAB = { className: 'border-accent text-text' }
const EXACT = { exact: true }

/** A scenario's editor: its title and world above, its story and own catalogues as tabs. */
function ScenarioLayout() {
  const { t } = useTranslation('scenarios')
  const { scenarioId } = Route.useParams()
  const { data: scenario } = useSuspenseQuery(scenarioQuery(scenarioId))
  const { data: world } = useSuspenseQuery(worldQuery(scenario.worldId))

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
        <Link
          to="/worlds/$worldId/scenarios"
          params={{ worldId: world.id }}
          className="mb-6 inline-flex items-center gap-1.5 text-label text-muted transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <p className="text-meta text-subtle uppercase">{world.labels.en}</p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-serif text-[1.75rem] leading-tight font-medium text-text">
            {scenario.labels.en}
          </h1>
          <span className="rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-meta text-muted uppercase">
            {t(`statuses.${scenario.status}`)}
          </span>
        </div>
        <p className="mt-1 font-mono text-label text-subtle">{scenario.reference}</p>

        <nav
          aria-label={t('tabs.label')}
          className="mt-6 mb-8 flex gap-5 overflow-x-auto border-b border-border"
        >
          <Link
            to="/scenarios/$scenarioId"
            params={{ scenarioId }}
            activeOptions={EXACT}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.story')}
          </Link>
          <Link
            to="/scenarios/$scenarioId/npcs"
            params={{ scenarioId }}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.npcs')}
          </Link>
          <Link
            to="/scenarios/$scenarioId/locations"
            params={{ scenarioId }}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.locations')}
          </Link>
          <Link
            to="/scenarios/$scenarioId/items"
            params={{ scenarioId }}
            activeProps={ACTIVE_TAB}
            className={TAB}
          >
            {t('tabs.items')}
          </Link>
        </nav>

        <Outlet />
      </main>
    </>
  )
}
