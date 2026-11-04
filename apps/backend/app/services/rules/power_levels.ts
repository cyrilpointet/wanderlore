import type { PowerLevel } from './types.js'

/**
 * What a world's power level gives a character at creation (rules, section
 * 3bis): the professional points to share among the skills of their
 * profession, and the most any skill may be worth once created. Fixed by the
 * system; a world only picks its level.
 */
export type PowerLevelScale = {
  professionalPoints: number
  /** Null: no cap. */
  skillCap: number | null
}

export const POWER_LEVEL_SCALE: Record<PowerLevel, PowerLevelScale> = {
  normal: { professionalPoints: 250, skillCap: 75 },
  heroic: { professionalPoints: 325, skillCap: 90 },
  epic: { professionalPoints: 400, skillCap: 101 },
  superhuman: { professionalPoints: 500, skillCap: null },
}

/** The personal points, for any skill of the world: INT × 10, the raised INT. */
export const PERSONAL_POINTS_PER_INT = 10
