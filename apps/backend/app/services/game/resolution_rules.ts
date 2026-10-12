import type { WorldDefinition } from './world.js'

/** A category arbitration may pick, with what it covers. Never the skill. */
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

/** The skill a roll uses for this category. Arbitration never sees it. */
export function skillFor(world: WorldDefinition, actionType: string): string {
  const rule = world.actionTypes.find((candidate) => candidate.actionType === actionType)

  if (rule === undefined) {
    throw new UnknownActionTypeError(world.reference, actionType)
  }

  return rule.associatedSkill
}
