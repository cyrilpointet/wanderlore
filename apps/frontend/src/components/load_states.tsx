import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION } from './actions'

/** A list that could not be read: why, and **Try again**. */
export function LoadError({
  message,
  retrying,
  onRetry,
}: {
  /** Already worded for the player. */
  message: string
  retrying: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <div role="alert" className="rounded-lg border border-danger/60 p-5 text-body text-text">
      <p className="flex items-center gap-2">
        <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={`mt-4 ${PRIMARY_ACTION}`}
      >
        {t('tryAgain')}
      </button>
    </div>
  )
}

/** Cards on their way: grey shapes in their place, announced once. */
export function CardSkeletons({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="rounded-lg border border-border bg-surface-1 p-5 sm:p-6"
        >
          <div className="flex flex-col gap-3 motion-safe:animate-pulse">
            <div className="h-6 w-2/5 rounded-sm bg-surface-2" />
            <div className="h-4 w-3/5 rounded-sm bg-surface-2" />
            <div className="mt-3 flex justify-between">
              <div className="h-4 w-14 rounded-sm bg-surface-2" />
              <div className="h-4 w-20 rounded-sm bg-surface-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
