import vine from '@vinejs/vine'

import type { ArbitrationOutput, TurnEffects } from './prompts/types.js'

/**
 * Nothing coming out of the model is trusted.
 *
 * The gateway guarantees parsable JSON, never valid JSON: shape, bounds and —
 * above all — the existence of every identifier are checked here, before a
 * single field reaches the state. Whatever falls outside is rejected, not
 * applied.
 */

export type RejectionReason = {
  field: string
  rule: string
  message: string
  /** The values the field had to come from, when it is a closed list. */
  allowed?: string[]
}

export type ValidationStep = 'arbitration' | 'narration' | 'extraction'

/**
 * A backend validation failure, deliberately distinct from `LlmError`.
 *
 * The model answered, and answered parsable JSON — the transport worked. What
 * failed is our own rule, so it carries its own category all the way to the
 * player, as the project's error-handling decision requires.
 */
export class TurnValidationError extends Error {
  readonly step: ValidationStep
  readonly reasons: RejectionReason[]

  constructor(step: ValidationStep, reasons: RejectionReason[]) {
    super(`Turn ${step} output rejected: ${reasons.map((item) => item.message).join('; ')}`)
    this.name = 'TurnValidationError'
    this.step = step
    this.reasons = reasons
  }
}

export type ValidationMeta = {
  /** Closed list: the action types of the world, read from `resolution_rules`. */
  actionTypes: string[]
  /** Closed list: the handles of the people present, the only possible targets. */
  npcHandles: string[]
  /** Closed list: the places the world defines, and so can label. */
  locations: string[]
  /** Bounds the damage or healing a single turn may claim. */
  hitPointsMax: number
}

/**
 * Stable English reference, never a display name.
 *
 * A flag that arrives as "Queen's favour earned" would never match the one
 * written last turn, and the state would silently grow duplicates.
 */
const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

const MAX_FLAGS_PER_TURN = 5

const arbitrationValidator = vine.withMetaData<ValidationMeta>().create({
  intent: vine.object({
    type: vine.string().regex(REFERENCE),
    /** Someone present, by handle — never a name the backend could not resolve. */
    target: vine.enum((field) => (field.meta as ValidationMeta).npcHandles).nullable(),
    summary: vine.string().maxLength(500),
  }),
  validity: vine.object({
    factual: vine.boolean(),
    plausibility: vine.enum(['plausible', 'borderline', 'impossible'] as const),
    justification: vine.string().maxLength(500),
  }),
  resolution: vine.object({
    mode: vine.enum(['automatic_success', 'narrative_automatic_failure', 'roll_required'] as const),
    /**
     * The closed list the rules document demands: a category of the world,
     * never a skill and never one it invented. The backend derives the skill.
     */
    action_type: vine.enum((field) => (field.meta as ValidationMeta).actionTypes).nullable(),
    difficulty: vine.enum(['easy', 'medium', 'hard', 'very_hard'] as const).nullable(),
  }),
  alert: vine.object({
    prompt_injection_suspected: vine.boolean(),
    out_of_scope: vine.boolean(),
  }),
})

const extractionValidator = vine.withMetaData<ValidationMeta>().create({
  /**
   * A place the model made up would reach the player as a raw reference,
   * with no label to show and no translation to come.
   */
  movement: vine.enum((field) => (field.meta as ValidationMeta).locations).nullable(),
  scenario_flags: vine.array(vine.string().regex(REFERENCE)).maxLength(MAX_FLAGS_PER_TURN),
  hit_points_delta: vine.number().withoutDecimals(),
})

export async function validateArbitration(
  payload: unknown,
  meta: ValidationMeta
): Promise<ArbitrationOutput> {
  const output = await run<ArbitrationOutput>('arbitration', arbitrationValidator, payload, meta)

  const reasons = coherenceReasons(output)

  if (reasons.length > 0) {
    throw new TurnValidationError('arbitration', reasons)
  }

  return output
}

export async function validateExtraction(
  payload: unknown,
  meta: ValidationMeta
): Promise<TurnEffects> {
  const output = await run<TurnEffects>('extraction', extractionValidator, payload, meta)

  const reasons = effectReasons(output, meta)

  if (reasons.length > 0) {
    throw new TurnValidationError('extraction', reasons)
  }

  return output
}

/**
 * Cross-field coherence, which no per-field schema can express: a roll needs
 * a category and a difficulty, and an outcome settled without one has neither.
 */
function coherenceReasons(output: {
  resolution: { mode: string; action_type: string | null; difficulty: string | null }
}): RejectionReason[] {
  const { mode, action_type: actionType, difficulty } = output.resolution

  if (mode === 'roll_required') {
    return [
      ...(actionType === null
        ? [reason('resolution.action_type', 'required', 'A roll needs an action type.')]
        : []),
      ...(difficulty === null
        ? [reason('resolution.difficulty', 'required', 'A roll needs a difficulty to beat.')]
        : []),
    ]
  }

  return [
    ...(actionType !== null
      ? [reason('resolution.action_type', 'forbidden', 'No roll, so no action type applies.')]
      : []),
    ...(difficulty !== null
      ? [reason('resolution.difficulty', 'forbidden', 'No roll, so no difficulty applies.')]
      : []),
  ]
}

/**
 * Bounds that depend on the character, so they cannot live in the schema.
 */
function effectReasons(effect: TurnEffects | null, meta: ValidationMeta): RejectionReason[] {
  if (effect === null) {
    return []
  }

  if (Math.abs(effect.hit_points_delta) > meta.hitPointsMax) {
    return [
      reason(
        'hit_points_delta',
        'range',
        `A single turn cannot move hit points by more than ${meta.hitPointsMax}.`
      ),
    ]
  }

  return []
}

async function run<TOutput>(
  step: ValidationStep,
  validator: { tryValidate: (data: unknown, options: { meta: ValidationMeta }) => Promise<any> },
  payload: unknown,
  meta: ValidationMeta
): Promise<TOutput> {
  const [error, output] = await validator.tryValidate(payload, { meta })

  if (error) {
    throw new TurnValidationError(step, toReasons(error))
  }

  return output as TOutput
}

function toReasons(error: unknown): RejectionReason[] {
  const messages = (error as { messages?: unknown }).messages

  if (!Array.isArray(messages)) {
    return [reason('*', 'invalid', (error as Error).message)]
  }

  return messages.map(
    (entry: { field?: string; rule?: string; message?: string; meta?: { choices?: unknown } }) => {
      const rejected = reason(
        entry.field ?? '*',
        entry.rule ?? 'invalid',
        entry.message ?? 'Rejected.'
      )
      const choices = entry.meta?.choices

      /** A closed list names its valid values, so a second attempt can pick one. */
      return Array.isArray(choices) ? { ...rejected, allowed: choices.map(String) } : rejected
    }
  )
}

function reason(field: string, rule: string, message: string): RejectionReason {
  return { field, rule, message }
}
