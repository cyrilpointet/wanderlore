import type { ReactNode } from 'react'

/**
 * A small paper tag with a punched hole: where a scene stands, or which
 * scenario a game is. Two lines: the main one, then a quieter one.
 */
export function PlaceTag({
  title,
  subtitle,
  flat = false,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** Lying on a card rather than on the table: no shadow of its own. */
  flat?: boolean
  className?: string
}) {
  return (
    // Placed by the caller; the tag itself holds its punched hole.
    <div className={`flex min-w-0 ${className}`}>
      <div
        className={`relative inline-flex max-w-full min-w-0 flex-col gap-px rounded-[3px] border border-border-strong bg-card py-[7px] pr-3.5 pl-[26px] ${flat ? '' : 'shadow-card'}`}
      >
        <span
          aria-hidden
          className="absolute top-1/2 left-2.5 size-[7px] -translate-y-1/2 rounded-full bg-bg shadow-tray"
        />
        <span className="truncate text-label leading-[1.3] font-semibold text-text">{title}</span>
        {subtitle && (
          <span className="truncate text-[0.71875rem] leading-[1.3] text-subtle">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
