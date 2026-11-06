import type { ReactNode } from 'react'

/**
 * The dice of the table, drawn rather than iconised (front spec, section 8):
 * ivory in both themes, a soft shadow on the table. Purely visual — what they
 * show always comes from the backend.
 */

const D10_SIZES = {
  small: 'h-[41px] w-[38px]',
  medium: 'h-[49px] w-[46px]',
  large: 'h-[70px] w-[66px]',
}

/**
 * A ten-sided die seen from above: kite faces, the number on the top face.
 * `face` is what it shows — a number, `?` before a throw, nothing at rest —
 * or the running faces of a throw.
 */
export function D10({
  face,
  size = 'medium',
  className = '',
}: {
  face: ReactNode
  size?: keyof typeof D10_SIZES
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`relative inline-block drop-shadow-die ${D10_SIZES[size]} ${className}`}
    >
      <svg viewBox="0 0 64 68" className="absolute inset-0 size-full">
        <g className="stroke-die-line" strokeWidth={1.2} strokeLinejoin="round">
          <path d="M32 3L4 27L17 31Z" className="fill-die-side" />
          <path d="M32 3L60 27L47 31Z" className="fill-die-dark" />
          <path d="M4 27L10 45L32 65L32 46L17 31Z" className="fill-die-side" />
          <path d="M60 27L54 45L32 65L32 46L47 31Z" className="fill-die-dark" />
          <path d="M32 3L47 31L32 46L17 31Z" className="fill-die" />
        </g>
      </svg>
      {/* The top face spans 17–47 of 64 across and 3–46 of 68 down. */}
      <span
        className={`absolute top-[22%] left-[30%] grid h-[30%] w-[40%] place-items-center overflow-hidden leading-none font-bold text-die-ink tabular-nums ${size === 'large' ? 'text-[1.0625rem]' : 'text-[0.8125rem]'}`}
      >
        {face}
      </span>
    </span>
  )
}

/** Where the pips of each face of a d6 sit, on a grid of three by three. */
const D6_PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

/** A six-sided die with its pips; `aside` when it is the one a result leaves out. */
export function D6({
  value,
  aside = false,
  className = '',
}: {
  value: number
  aside?: boolean
  className?: string
}) {
  const pips = D6_PIPS[value] ?? []

  return (
    <span
      aria-hidden
      className={`grid size-[30px] shrink-0 grid-cols-3 grid-rows-3 place-items-center rounded-md border border-die-line bg-die p-1 ${
        aside
          ? 'translate-y-1 opacity-40'
          : 'shadow-[inset_0_-2px_0_var(--color-die-side),0_2px_3px_rgb(60_45_25/0.2)]'
      } ${className}`}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={pips.includes(index + 1) ? 'size-[5px] rounded-full bg-die-ink' : undefined}
        />
      ))}
    </span>
  )
}
