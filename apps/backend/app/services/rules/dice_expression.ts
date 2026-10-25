import type { DiceService } from '#services/dice'

/**
 * A dice expression as BRP writes them — `1D6+1`, `2D6`, `-1D4`, `1D3-1` —
 * parsed once into terms the backend can roll or take the maximum of.
 *
 * Written in content (weapon damage) and derived from characteristics (the
 * damage modifier), so it is checked the same way in both places.
 */
export type DiceExpression = {
  dice: { count: number; faces: number; sign: 1 | -1 }[]
  constant: number
}

/** A whole expression: signed terms, each a number of dice or a flat number. */
const SHAPE = /^[+-]?(\d+D\d+|\d+)([+-](\d+D\d+|\d+))*$/
const TERM = /([+-]?)(\d+)(?:D(\d+))?/g

/** Bounds that keep a typo from rolling a thousand dice. */
const MAX_COUNT = 20
const MIN_FACES = 2
const MAX_FACES = 100
const MAX_CONSTANT = 100

export class InvalidDiceExpressionError extends Error {
  readonly expression: string

  constructor(expression: string) {
    super(`"${expression}" is no dice expression such as 1D6+1.`)
    this.name = 'InvalidDiceExpressionError'
    this.expression = expression
  }
}

export function parseDice(text: string): DiceExpression {
  const compact = text.replace(/\s+/g, '').toUpperCase()

  if (!SHAPE.test(compact)) {
    throw new InvalidDiceExpressionError(text)
  }

  const expression: DiceExpression = { dice: [], constant: 0 }

  for (const [, sign, amount, faces] of compact.matchAll(TERM)) {
    const signed = sign === '-' ? -1 : 1
    const value = Number(amount)

    if (faces === undefined) {
      if (value > MAX_CONSTANT) throw new InvalidDiceExpressionError(text)
      expression.constant += signed * value
      continue
    }

    const sides = Number(faces)

    if (value < 1 || value > MAX_COUNT || sides < MIN_FACES || sides > MAX_FACES) {
      throw new InvalidDiceExpressionError(text)
    }

    expression.dice.push({ count: value, faces: sides, sign: signed })
  }

  return expression
}

export function isDiceExpression(text: string): boolean {
  try {
    parseDice(text)
    return true
  } catch {
    return false
  }
}

/** Every die rolled, in the order written, plus the flat part. */
export function rollExpression(dice: DiceService, expression: DiceExpression): number {
  let total = expression.constant

  for (const { count, faces, sign } of expression.dice) {
    for (let die = 0; die < count; die += 1) {
      total += sign * dice.rollDie(faces)
    }
  }

  return total
}

/** The highest the expression can roll: what a critical hit deals with the weapon. */
export function maximumOf(expression: DiceExpression): number {
  return expression.dice.reduce(
    (total, { count, faces, sign }) => total + sign * (sign > 0 ? count * faces : count),
    expression.constant
  )
}
