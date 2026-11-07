import { DAY, FIXED_DURATIONS, periodStartOf, secondsOfTime } from './game_time.js'
import type {
  EventCondition,
  EventDelay,
  EventMoment,
  NpcDisposition,
  ScenarioEvent,
} from './content/types.js'

/**
 * The events of a scenario (roadmap, Phase 11): when each one falls, whether
 * its conditions hold, and whether the character is there to see it. Pure: the
 * turn reads the game into a snapshot, then asks — the model is never asked.
 */

/** How many times in a turn the events of the state are looked at again, one set off another. */
export const EVENT_CHAIN_DEPTH = 3

/**
 * What the conditions of an event read of a game. People and items are the
 * unique ones, by reference — the handle of a unique is its reference.
 */
export type WorldSnapshot = {
  /** The flags set, by reference. */
  flags: Set<string>
  /** The unique places the game has been to. */
  visited: Set<string>
  /** The unique people the game has an instance of. */
  npcs: Map<string, SnapshotNpc>
  /** The unique items the game has a copy of. */
  items: Map<string, SnapshotItem>
}

export type SnapshotNpc = {
  status: 'present' | 'absent' | 'dying' | 'dead'
  disposition: NpcDisposition
  /** The handle of the place they are in, if it is known — a unique place's is its reference. */
  place: string | null
}

export type SnapshotItem = {
  holder: { holder: 'character' } | { holder: 'npc' | 'location'; reference: string } | null
  gone: boolean
}

/** What became of an event in a game, by its reference; none for one nothing happened to yet. */
export type EventProgress = {
  armedAt: number | null
  firedAt: number | null
  cancelledAt: number | null
}

export const NOT_STARTED: EventProgress = { armedAt: null, firedAt: null, cancelledAt: null }

export function holds(condition: EventCondition, snapshot: WorldSnapshot): boolean {
  switch (condition.type) {
    case 'flag':
      return snapshot.flags.has(condition.flag)
    case 'location_visited':
      return snapshot.visited.has(condition.location)
    case 'npc_dead':
      return snapshot.npcs.get(condition.npc)?.status === 'dead'
    case 'npc_disposition':
      return snapshot.npcs.get(condition.npc)?.disposition === condition.disposition
    case 'npc_at': {
      const npc = snapshot.npcs.get(condition.npc)

      return npc !== undefined && npc.status !== 'dead' && npc.place === condition.location
    }
    case 'item_gone':
      return snapshot.items.get(condition.item)?.gone === true
    case 'item_held_by': {
      const item = snapshot.items.get(condition.item)

      if (item === undefined || item.gone || item.holder === null) {
        return false
      }

      const wanted = condition.holder

      return wanted.holder === 'character'
        ? item.holder.holder === 'character'
        : item.holder.holder === wanted.holder && item.holder.reference === wanted.reference
    }
  }
}

export function allHold(conditions: EventCondition[], snapshot: WorldSnapshot): boolean {
  return conditions.every((condition) => holds(condition, snapshot))
}

export function anyHolds(conditions: EventCondition[], snapshot: WorldSnapshot): boolean {
  return conditions.some((condition) => holds(condition, snapshot))
}

/** A deadline, in game time: the start of its period, or its time of day, on its day. */
export function momentOf(at: EventMoment): number {
  const day = (at.day - 1) * DAY

  if (at.time !== null) {
    return day + secondsOfTime(at.time)
  }

  return day + (at.period === null ? 0 : periodStartOf(at.period))
}

export function secondsOfDelay(delay: EventDelay): number {
  return delay.label === 'days' ? delay.count * DAY : FIXED_DURATIONS[delay.label]
}

/** Whether an event falls at a moment of the clock — a deadline, or one already armed. */
export function isTimed(event: ScenarioEvent): boolean {
  return event.when.at !== null || event.when.delay !== null
}

/** Whether an event is settled: it happened, or never will. */
export function isSettled(progress: EventProgress): boolean {
  return progress.firedAt !== null || progress.cancelledAt !== null
}

/**
 * When an event falls due, if the clock alone decides it: its deadline, or
 * the end of its delay once armed. Null for an event of the state not yet
 * armed — or not timed at all.
 */
export function dueTimeOf(event: ScenarioEvent, progress: EventProgress): number | null {
  if (event.when.at !== null) {
    return momentOf(event.when.at)
  }

  if (event.when.delay !== null && progress.armedAt !== null) {
    return progress.armedAt + secondsOfDelay(event.when.delay)
  }

  return null
}

/** An event the clock brought, and what came of it. */
export type DueEvent = {
  event: ScenarioEvent
  /** When it fell due, in game time. */
  at: number
  outcome: 'fired' | 'cancelled'
}

/**
 * The timed events due by `until`, in the order they fall: a deadline whose
 * conditions hold — one that waits on its conditions falls once they do —
 * and an armed event whose delay is over. Each is cancelled instead when one
 * of its `unless` holds.
 */
export function timedEventsDue(
  events: ScenarioEvent[],
  progressOf: (reference: string) => EventProgress,
  snapshot: WorldSnapshot,
  until: number
): DueEvent[] {
  const due: DueEvent[] = []

  events.forEach((event) => {
    const progress = progressOf(event.reference)
    const at = dueTimeOf(event, progress)

    if (isSettled(progress) || at === null || at > until) {
      return
    }

    /** An armed event has already met its conditions; a deadline meets them as it falls. */
    if (event.when.at !== null && !allHold(event.when.conditions, snapshot)) {
      return
    }

    due.push({
      event,
      at,
      outcome: anyHolds(event.unless, snapshot) ? 'cancelled' : 'fired',
    })
  })

  return due.sort((a, b) => a.at - b.at)
}

/**
 * What the state sets off now: the events that are no deadline and whose
 * conditions hold — armed when they fall after a delay, cancelled when one of
 * their `unless` holds, set off otherwise.
 */
export function stateEventsDue(
  events: ScenarioEvent[],
  progressOf: (reference: string) => EventProgress,
  snapshot: WorldSnapshot
): { fire: ScenarioEvent[]; arm: ScenarioEvent[]; cancel: ScenarioEvent[] } {
  const result = {
    fire: [] as ScenarioEvent[],
    arm: [] as ScenarioEvent[],
    cancel: [] as ScenarioEvent[],
  }

  for (const event of events) {
    const progress = progressOf(event.reference)

    if (
      event.when.at !== null ||
      event.when.conditions.length === 0 ||
      isSettled(progress) ||
      progress.armedAt !== null ||
      !allHold(event.when.conditions, snapshot)
    ) {
      continue
    }

    if (event.when.delay !== null) {
      result.arm.push(event)
    } else if (anyHolds(event.unless, snapshot)) {
      result.cancel.push(event)
    } else {
      result.fire.push(event)
    }
  }

  return result
}

/**
 * Whether the character sees an event: it is felt everywhere, or it happens
 * in the place they stand in or in one that contains it. `around` is that
 * place's reference, then its parents'.
 */
/** Whether an event wins or loses the game (roadmap, Phase 12). */
export function endsTheGame(event: ScenarioEvent): boolean {
  return event.effects.some(({ type }) => type === 'game_ended')
}

/**
 * The timed events of a turn, up to the first that ends the game: nothing
 * falls after the end. Pure.
 */
export function untilTheEnd(due: DueEvent[]): DueEvent[] {
  const end = due.findIndex(({ event, outcome }) => outcome === 'fired' && endsTheGame(event))

  return end === -1 ? due : due.slice(0, end + 1)
}

export function witnesses(event: ScenarioEvent, around: string[]): boolean {
  return event.place === null || around.includes(event.place)
}

/**
 * The events the character knows are coming, and may wait for: not settled
 * yet, and every condition of their `foreseeable` holds.
 */
export function foreseeableEvents(
  events: ScenarioEvent[],
  progressOf: (reference: string) => EventProgress,
  snapshot: WorldSnapshot
): ScenarioEvent[] {
  return events.filter(
    (event) =>
      event.foreseeable !== null &&
      !isSettled(progressOf(event.reference)) &&
      allHold(event.foreseeable, snapshot)
  )
}

/**
 * When an event awaited falls, if it does within `(from, until]`: timed, its
 * conditions met, none of its `unless` holding. Null when it would not come
 * — the character waits in vain.
 */
export function awaitedTimeOf(
  event: ScenarioEvent,
  progress: EventProgress,
  snapshot: WorldSnapshot,
  window: { from: number; until: number }
): number | null {
  const at = dueTimeOf(event, progress)

  if (
    at === null ||
    isSettled(progress) ||
    !allHold(event.when.at === null ? [] : event.when.conditions, snapshot) ||
    anyHolds(event.unless, snapshot)
  ) {
    return null
  }

  /** Overdue — waiting on conditions that hold now: it falls at once. */
  const when = Math.max(at, window.from + 1)

  return when <= window.until ? when : null
}
