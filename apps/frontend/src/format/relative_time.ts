const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/**
 * The largest unit that fits the time elapsed since `date`, as a negative
 * count ("2 hours ago"). Only the unit is chosen here: the wording belongs to
 * `Intl.RelativeTimeFormat`, through i18next's `relativetime` formatter.
 *
 * Under a minute reads as "now" (`numeric: 'auto'`).
 */
export function relativeTime(
  date: Date,
  now: Date = new Date()
): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  // A clock slightly ahead of the server's must not read as "in 2 seconds".
  const elapsed = Math.max(0, (now.getTime() - date.getTime()) / 1000)

  for (const [unit, seconds] of UNITS) {
    if (elapsed >= seconds) return { value: -Math.floor(elapsed / seconds), unit }
  }

  return { value: 0, unit: 'second' }
}
