import { PERIODS, periodAt, periodStartsWithin, type Period } from './game_time.js'
import type { ScheduleEntry } from './content/types.js'
import type { NpcDefinition, WorldDefinition } from './world.js'

/**
 * The schedules of unique people (roadmap, Phase 11): where each one is,
 * period by period, and when they go from one place to the next. Derived
 * from the clock like the period itself, never stored. Pure: the turn reads
 * the game, then asks.
 */

export type ScheduledNpc = Extract<NpcDefinition, { kind: 'unique' }>

/** The unique people whose schedule still runs: one they have, that no event stopped. */
export function scheduledNpcs(world: WorldDefinition, stopped: Set<string>): ScheduledNpc[] {
  return world.npcs.filter(
    (npc): npc is ScheduledNpc =>
      npc.kind === 'unique' && npc.schedule.length > 0 && !stopped.has(npc.reference)
  )
}

/** The entry covering the period the clock stands in, if one does. */
export function entryAt(schedule: ScheduleEntry[], gameTime: number): ScheduleEntry | null {
  return entryFor(schedule, periodAt(gameTime))
}

/**
 * Where the schedule last sent someone, as the clock stands: the entry of the
 * period, or else of the latest one before it that has an entry. A period
 * with none leaves them where they were — for someone the game has not met,
 * the place the schedule sent them last. Null for an empty schedule.
 */
export function lastEntryAt(schedule: ScheduleEntry[], gameTime: number): ScheduleEntry | null {
  const index = PERIODS.indexOf(periodAt(gameTime))

  for (let back = 0; back < PERIODS.length; back++) {
    const period = PERIODS[(index - back + PERIODS.length) % PERIODS.length]
    const entry = entryFor(schedule, period)

    if (entry !== null) {
      return entry
    }
  }

  return null
}

/** A change of place a schedule makes: when, and into which entry. */
export type ScheduledMove = { at: number; entry: ScheduleEntry }

/**
 * Every change of place the schedule makes within `(from, to]`, in order: a
 * period begins whose entry sends them somewhere other than where the
 * schedule had them.
 */
export function movesWithin(schedule: ScheduleEntry[], from: number, to: number): ScheduledMove[] {
  const moves: ScheduledMove[] = []
  let place = lastEntryAt(schedule, from)?.location ?? null

  for (const { at, period } of periodStartsWithin(from, to)) {
    const entry = entryFor(schedule, period)

    if (entry !== null && entry.location !== place) {
      moves.push({ at, entry })
      place = entry.location
    }
  }

  return moves
}

/** The first time within `(from, to]` the schedule brings someone into `place`, if it does. */
export function nextArrivalIn(
  schedule: ScheduleEntry[],
  place: string,
  from: number,
  to: number
): ScheduledMove | null {
  return movesWithin(schedule, from, to).find(({ entry }) => entry.location === place) ?? null
}

/** The first time within `(from, to]` the schedule takes someone out of `place`, if it does. */
export function nextDepartureFrom(
  schedule: ScheduleEntry[],
  place: string,
  from: number,
  to: number
): ScheduledMove | null {
  let here = lastEntryAt(schedule, from)?.location === place

  for (const move of movesWithin(schedule, from, to)) {
    if (here && move.entry.location !== place) {
      return move
    }
    here = move.entry.location === place
  }

  return null
}

function entryFor(schedule: ScheduleEntry[], period: Period): ScheduleEntry | null {
  return schedule.find(({ periods }) => periods.includes(period)) ?? null
}
