/**
 * The time that passes in the game, as the backend keeps it (roadmap, Phase 7).
 *
 * A game clock is a count of seconds since midnight of the game's first day:
 * fictional time, with no bearing on the real one — the `Clock` port has
 * nothing to do with it. The time of day, the period, the day and the date
 * all derive from it, and none of them is ever stored.
 *
 * Fixed in the code, the same for every world, like the rules engine: the
 * scale of durations, the bounds of the periods, the Gregorian calendar.
 * Pure, so every rule here is tested without a database or a model.
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/**
 * The scale of durations arbitration picks from (roadmap, Phase 7). The model
 * only ever reads what each one covers; the values below are the backend's.
 */
export const DURATION_LABELS = ['moment', 'minutes', 'hour', 'hours', 'days', 'until'] as const

export type DurationLabel = (typeof DURATION_LABELS)[number]

/** The labels worth a fixed span of time, a passage between places included. */
export const FIXED_DURATIONS = {
  moment: MINUTE,
  minutes: 10 * MINUTE,
  hour: HOUR,
  hours: 4 * HOUR,
} as const

export type FixedDuration = keyof typeof FIXED_DURATIONS

/** The longest a single turn may last: past a week, a journey is played over several turns. */
export const MAX_DAYS = 7

/**
 * The seven periods of the day, in the order they follow one another from
 * dawn. Derived from the time, never stored; the same bounds in every world,
 * with no season (roadmap, Phase 7).
 */
export const PERIODS = [
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'evening',
  'night',
] as const

export type Period = (typeof PERIODS)[number]

/** When each period begins, in hours since midnight. Night runs past midnight to dawn. */
const PERIOD_STARTS: Record<Period, number> = {
  dawn: 5,
  morning: 7,
  midday: 12,
  afternoon: 14,
  dusk: 18,
  evening: 20,
  night: 22,
}

/** What a turn lasts, as validated: a label, with how many days or until which period. */
export type Duration =
  { label: FixedDuration } | { label: 'days'; count: number } | { label: 'until'; period: Period }

/** The days of the week, Sunday first as `Date.getUTCDay()` counts them. */
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

/**
 * How long a duration lasts from `gameTime`, in seconds. Only `until`
 * depends on when it starts.
 */
export function secondsOf(duration: Duration, gameTime: number): number {
  switch (duration.label) {
    case 'days':
      return duration.count * DAY
    case 'until':
      return secondsUntil(duration.period, gameTime)
    default:
      return FIXED_DURATIONS[duration.label]
  }
}

/**
 * The wait until the next start of a period, always strictly in the future:
 * waiting for the night while it is already night lasts until the next one.
 */
export function secondsUntil(period: Period, gameTime: number): number {
  const start = PERIOD_STARTS[period] * HOUR
  const intoDay = secondsIntoDay(gameTime)

  return start > intoDay ? start - intoDay : DAY - intoDay + start
}

/** The period the clock stands in. */
export function periodAt(gameTime: number): Period {
  const hour = Math.floor(secondsIntoDay(gameTime) / HOUR)

  /** The last period begun since midnight; before dawn, the night that began the day before. */
  return PERIODS.findLast((period) => PERIOD_STARTS[period] <= hour) ?? 'night'
}

/** The day of the game the clock stands in, the first one being 1. */
export function dayOf(gameTime: number): number {
  return Math.floor(gameTime / DAY) + 1
}

/**
 * The date the clock stands on, in the Gregorian calendar, when the game has a
 * date to start from. ISO `YYYY-MM-DD`: proleptic Gregorian, so 1625 counts
 * the way France did.
 */
export function dateOf(gameTime: number, startDate: string | null): string | null {
  if (startDate === null) {
    return null
  }

  return toIsoDate(dayAfter(startDate, dayOf(gameTime) - 1))
}

/** The day of the week of a date the clock stands on, if it has one. */
export function weekdayOf(gameTime: number, startDate: string | null): Weekday | null {
  if (startDate === null) {
    return null
  }

  return WEEKDAYS[dayAfter(startDate, dayOf(gameTime) - 1).getUTCDay()]
}

/**
 * The time of day, rounded to the nearest quarter of an hour: the narrator is
 * never handed a precision the scale of durations does not have.
 */
export function quarterHourOf(gameTime: number): string {
  const quarter = 15 * MINUTE
  const rounded = Math.round(secondsIntoDay(gameTime) / quarter) * quarter

  return timeOfDay(rounded % DAY)
}

/** A time of day as a scenario writes it, `HH:MM`, in seconds since midnight. */
export function secondsOfTime(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)

  if (match === null) {
    throw new Error(`"${time}" is no time of day: expected HH:MM.`)
  }

  return Number(match[1]) * HOUR + Number(match[2]) * MINUTE
}

/** `HH:MM` for a number of seconds since midnight. */
function timeOfDay(seconds: number): string {
  const hours = Math.floor(seconds / HOUR)
  const minutes = Math.floor((seconds % HOUR) / MINUTE)

  return `${pad(hours, 2)}:${pad(minutes, 2)}`
}

function secondsIntoDay(gameTime: number): number {
  return ((gameTime % DAY) + DAY) % DAY
}

/**
 * Counted in UTC, which has no daylight saving nor historical offset: a day
 * is always 24 hours there. `setUTCFullYear` keeps a year below 100 from
 * being read as 19xx.
 */
function dayAfter(startDate: string, days: number): Date {
  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(0)

  date.setUTCFullYear(year, month - 1, day + days)

  return date
}

function toIsoDate(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}
