import type { ReactNode } from 'react'

const TONES = {
  success: 'bg-success-soft text-success',
  failure: 'bg-danger-soft text-danger',
  neutral: 'bg-accent-soft text-accent',
}

/**
 * A result stamped on a card: the outcome of a roll, a failed scenario, an
 * equipped item. The words carry the meaning; the colour only doubles them.
 */
export function Stamp({
  tone,
  children,
  className = '',
}: {
  tone: keyof typeof TONES
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border-[1.5px] border-current px-[7px] pt-1 pb-[3px] text-[0.65625rem] leading-[1.1] font-bold tracking-[0.08em] whitespace-nowrap uppercase ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
