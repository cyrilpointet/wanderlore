import type { SVGProps } from 'react'

/**
 * A d10 seen point up, drawn in Lucide's stroke style: Lucide only has the
 * d6, and the BRP rolls percentile dice.
 */
export function D10Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2 2 13.5 12 22l10-8.5Z" />
      <path d="M12 2 6.5 12l5.5 4 5.5-4Z" />
      <path d="M2 13.5 6.5 12M22 13.5 17.5 12M12 16v6" />
    </svg>
  )
}
