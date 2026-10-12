import { useTranslation } from 'react-i18next'

import type { CoherenceIssue } from './queries'

/**
 * Everything that keeps a scenario from being published, all at once, each
 * in words with the field it concerns.
 */
export function IssueList({ issues }: { issues: CoherenceIssue[] }) {
  const { t } = useTranslation('scenarios')

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-danger/60 p-4">
      <p className="text-body font-medium text-text">
        {t('publication.issuesTitle', { count: issues.length })}
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-text">
        {issues.map((issue, index) => (
          <li key={index}>
            {t(`issues.${issue.code}` as 'issues.unknown_skill', {
              reference: issue.reference ?? '',
              defaultValue: issue.code,
            })}{' '}
            <span className="font-mono text-label text-subtle">{issue.location}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
