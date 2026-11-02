/**
 * The long-term memory of a game (roadmap, Phase 9): which summaries a turn
 * reads, which turns they leave verbatim, and when a new one is due.
 *
 * Pure: it takes summaries as stored and turn numbers, and decides. Reading
 * and writing them is the summary service's job.
 *
 * Two levels. A `scene` summary condenses a block of turns; the `global` one
 * is rolling, and folds in the oldest scenes once there are too many. A turn
 * reads the latest global summary, the scenes it has not folded, then every
 * turn after the last of them — so no turn is ever missing from both, however
 * late the summary job runs.
 */

import { NARRATION_RECENT_TURNS } from './prompts/narration.js'

/**
 * How many turns no summary covers, older than the last ones the narrator
 * always reads verbatim, before a scene summary is written. Bounds how many
 * turns a step can be sent: the last ones, plus as many as this.
 * A starting value, to adjust against `llm:cost`.
 */
export const SCENE_SUMMARY_THRESHOLD = 8

/**
 * How many scene summaries a turn reads at most beside the global one. Past
 * it, the oldest are folded into a new global summary.
 */
export const SCENES_BEFORE_FOLD = 4

/**
 * The turns never summarised, whatever the threshold: the narrator reads them
 * verbatim, for the continuity of tone and dialogue.
 */
export const TURNS_KEPT_VERBATIM = NARRATION_RECENT_TURNS

export type SummaryLevel = 'scene' | 'global'

/** A summary as stored, reduced to what the memory reads. */
export type StoredSummary = {
  level: SummaryLevel
  content: string
  turnStart: number
  turnEnd: number
}

/** The summaries a turn reads, oldest first. */
export type Memory = {
  global: StoredSummary | null
  /** The scenes the global summary has not folded, oldest first. */
  scenes: StoredSummary[]
}

export type TurnRange = { start: number; end: number }

/**
 * The latest global summary, and the scenes after it. A superseded summary
 * stays in the base, never in the memory.
 */
export function memoryOf(summaries: StoredSummary[]): Memory {
  const global = latest(summaries.filter(({ level }) => level === 'global'))
  const folded = global?.turnEnd ?? 0
  const scenes = summaries
    .filter(({ level, turnStart }) => level === 'scene' && turnStart > folded)
    .sort((a, b) => a.turnEnd - b.turnEnd)

  return { global, scenes }
}

/** The last turn a summary covers; 0 when there is none. */
export function coveredUpTo(memory: Memory): number {
  return memory.scenes.at(-1)?.turnEnd ?? memory.global?.turnEnd ?? 0
}

/** What a step is told of the story before the turns it reads verbatim, oldest first. */
export function storySoFar(memory: Memory): string[] {
  return [
    ...(memory.global === null ? [] : [memory.global.content]),
    ...memory.scenes.map(({ content }) => content),
  ]
}

/**
 * The turns the next scene summary condenses: every one no summary covers but
 * the last ones, once there are enough of them. All of them rather than the
 * threshold's worth: a job that fell behind catches up in one call.
 */
export function sceneToSummarise(memory: Memory, lastTurn: number): TurnRange | null {
  const start = coveredUpTo(memory) + 1
  const end = lastTurn - TURNS_KEPT_VERBATIM

  return end - start + 1 >= SCENE_SUMMARY_THRESHOLD ? { start, end } : null
}

/** The oldest scenes past the limit, which the next global summary folds in. */
export function scenesToFold(memory: Memory): StoredSummary[] {
  const excess = memory.scenes.length - SCENES_BEFORE_FOLD

  return excess > 0 ? memory.scenes.slice(0, excess) : []
}

function latest(summaries: StoredSummary[]): StoredSummary | null {
  return summaries.reduce<StoredSummary | null>(
    (found, summary) => (found === null || summary.turnEnd > found.turnEnd ? summary : found),
    null
  )
}
