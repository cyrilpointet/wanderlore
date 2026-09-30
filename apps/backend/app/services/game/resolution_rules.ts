import ResolutionRule from '#models/resolution_rule'

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
export async function actionTypesOf(world: WorldDefinition): Promise<ActionType[]> {
  const rules = await ResolutionRule.query()
    .where('worldReference', world.reference)
    .orderBy('actionType')

  return rules.map(({ actionType, description }) => ({ actionType, description }))
}

/** The skill a roll uses for this category. Arbitration never sees it. */
export async function skillFor(world: WorldDefinition, actionType: string): Promise<string> {
  const rule = await ResolutionRule.query()
    .where('worldReference', world.reference)
    .where('actionType', actionType)
    .first()

  if (rule === null) {
    throw new UnknownActionTypeError(world.reference, actionType)
  }

  return rule.associatedSkill
}
