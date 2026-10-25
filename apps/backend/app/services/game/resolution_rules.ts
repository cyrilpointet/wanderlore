import { baseChanceOf } from '#services/rules/derived'
import type { Characteristic, Characteristics, RollBase } from '#services/rules/types'

import type { WorldDefinition } from './world.js'

/** A category arbitration may pick, with what it covers. Never what resolves it. */
export type ActionType = {
  actionType: string
  description: string
}

/**
 * An action type with no rule in this world. Arbitration's answer is checked
 * against the closed list before a roll, so reaching this is a bug, not a
 * player mistake.
 */
export class UnknownActionTypeError extends Error {
  readonly world: string
  readonly actionType: string

  constructor(world: string, actionType: string) {
    super(`No resolution rule for action type "${actionType}" in the ${world} world.`)
    this.name = 'UnknownActionTypeError'
    this.world = world
    this.actionType = actionType
  }
}

/**
 * The closed list handed to arbitration. Sorted, so the prompt reads the same
 * from one turn to the next whatever order the rows were written in.
 */
export function actionTypesOf(world: WorldDefinition): ActionType[] {
  return world.actionTypes
    .map(({ actionType, description }) => ({ actionType, description }))
    .sort((a, b) => a.actionType.localeCompare(b.actionType))
}

/** What a roll of this category tests: a skill, or a characteristic. */
export type Resolution =
  { kind: 'skill'; skill: string } | { kind: 'characteristic'; characteristic: Characteristic }

/** What resolves this category. Arbitration never sees it. */
export function resolutionFor(world: WorldDefinition, actionType: string): Resolution {
  const rule = world.actionTypes.find((candidate) => candidate.actionType === actionType)

  if (rule === undefined) {
    throw new UnknownActionTypeError(world.reference, actionType)
  }

  return rule.associatedSkill !== null
    ? { kind: 'skill', skill: rule.associatedSkill }
    : { kind: 'characteristic', characteristic: rule.associatedCharacteristic }
}

/** The sheet a roll reads its base from. */
export type RollingSheet = {
  characteristics: Characteristics
  skills: Record<string, number>
}

/**
 * What the roller has in what the category tests: the skill as their sheet
 * has it — or, never trained, its base chance in this world — or the score of
 * the characteristic.
 */
export function rollBaseFor(
  world: WorldDefinition,
  resolution: Resolution,
  sheet: RollingSheet
): RollBase {
  if (resolution.kind === 'characteristic') {
    return {
      kind: 'characteristic',
      characteristic: resolution.characteristic,
      value: sheet.characteristics[resolution.characteristic],
    }
  }

  const trained = sheet.skills[resolution.skill]

  if (trained !== undefined) {
    return { kind: 'skill', skill: resolution.skill, value: trained }
  }

  const skill = world.skills.find((entry) => entry.reference === resolution.skill)

  if (skill === undefined) {
    throw new Error(`Skill "${resolution.skill}" is not one of the ${world.reference} world.`)
  }

  return {
    kind: 'skill',
    skill: resolution.skill,
    value: baseChanceOf(skill.baseChance, sheet.characteristics),
  }
}
