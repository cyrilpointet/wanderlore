import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { FormAlert } from '@/content/field'
import { formFailureOf } from '@/content/form_errors'
import { PRIMARY, SECONDARY, SECTION } from '@/content/ui'
import { IssueList } from './issue_list'
import {
  type CoherenceIssue,
  type Scenario,
  publishScenario,
  scenarioQuery,
  scenariosQuery,
  unpublishScenario,
} from './queries'

/**
 * The player front, where a game master tries a draft out before publishing
 * it: a game master sees drafts in its New game catalogue.
 */
const PLAYER_FRONT: string = import.meta.env.VITE_PLAYER_URL ?? 'http://localhost:5173'

/**
 * Whether players are offered the scenario. Publishing checks that it holds
 * together, and lists everything that does not.
 */
export function Publication({ scenario }: { scenario: Scenario }) {
  const { t } = useTranslation('scenarios')
  const queryClient = useQueryClient()
  const published = scenario.status === 'published'

  const settle = (updated: Scenario) => {
    queryClient.setQueryData(scenarioQuery(scenario.id).queryKey, updated)
    void queryClient.invalidateQueries({ queryKey: scenariosQuery(scenario.worldId).queryKey })
  }

  const toggle = useMutation({
    mutationFn: () => (published ? unpublishScenario(scenario.id) : publishScenario(scenario.id)),
    onSuccess: settle,
  })

  const issues = issuesOf(toggle.error)

  return (
    <section className={`${SECTION} flex flex-col gap-4`}>
      <header>
        <h2 className="font-serif text-[1.25rem] text-text">{t('publication.title')}</h2>
        <p className="mt-1 text-label text-muted">
          {published ? t('publication.published') : t('publication.draft')}
        </p>
      </header>

      {issues ? (
        <IssueList issues={issues} />
      ) : (
        toggle.error && <FormAlert message={formFailureOf(toggle.error).general ?? ''} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={published ? SECONDARY : PRIMARY}
        >
          {published ? t('publication.unpublish') : t('publication.publish')}
        </button>
        <a
          href={`${PLAYER_FRONT}/games/new`}
          target="_blank"
          rel="noreferrer"
          className={SECONDARY}
        >
          <ExternalLink aria-hidden className="size-4" />
          {t('publication.tryOut')}
        </a>
      </div>
    </section>
  )
}

/** The coherence issues of a refused publication, if that is what failed. */
function issuesOf(error: unknown): CoherenceIssue[] | null {
  if (!(error instanceof ApiError) || error.code !== 'scenario_incoherent') return null

  const body = error.body as { error?: { details?: { issues?: CoherenceIssue[] } } }
  return body.error?.details?.issues ?? null
}
