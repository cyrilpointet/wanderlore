import { CircleAlert } from 'lucide-react'

import { errorMessage } from '@/i18n/errors'
import type { CreationIssue } from '../queries'

/** What the preview finds wrong with a field, each in the words of its code. */
export function Issues({
  issues,
  className = '',
}: {
  issues: CreationIssue[]
  className?: string
}) {
  if (issues.length === 0) return null

  // The same code twice on one field says the same thing twice.
  const codes = [...new Set(issues.map(({ code }) => code))]

  return (
    <ul className={`flex flex-col gap-1 ${className}`}>
      {codes.map((code) => (
        <li key={code} className="flex items-start gap-1.5 text-label text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {errorMessage({ code })}
        </li>
      ))}
    </ul>
  )
}
