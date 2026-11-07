import type { ReactNode } from 'react'

const TONES = {
  success: 'bg-success-soft text-success',
  failure: 'bg-danger-soft text-danger',
  neutral: 'bg-accent-soft text-accent',
}

const SIZES = {
  small: 'rounded-[3px] border-[1.5px] px-[7px] pt-1 pb-[3px] text-[0.65625rem] tracking-[0.08em]',
  /** The end of a game, stamped across the bottom of the sheet. */
  large: 'rounded-[5px] border-[2.5px] px-3.5 pt-2 pb-[7px] text-[0.9375rem] tracking-[0.16em]',
}

/**
 * A result stamped on a card: the outcome of a roll, a failed scenario, an
 * equipped item — or, large, the end of a game on the sheet. The words carry
 * the meaning; the colour only doubles them.
 */
export function Stamp({
  tone,
  size = 'small',
  children,
  className = '',
}: {
  tone: keyof typeof TONES
  size?: keyof typeof SIZES
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center border-current leading-[1.1] font-bold whitespace-nowrap uppercase ${SIZES[size]} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
