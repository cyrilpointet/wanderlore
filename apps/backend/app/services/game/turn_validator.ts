import vine from '@vinejs/vine'

import type { ArbitrationOutput, NarrationOutput, TurnEffects } from './prompts/types.js'

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
}

export type ValidationStep = 'arbitration' | 'narration'

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
  /** Closed list: the skills this character actually has. */
  skills: string[]
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

const effects = () =>
  vine.object({
    /**
     * A place the model made up would reach the player as a raw reference,
     * with no label to show and no translation to come.
     */
    movement: vine.enum((field) => (field.meta as ValidationMeta).locations).nullable(),
    scenario_flags: vine.array(vine.string().regex(REFERENCE)).maxLength(MAX_FLAGS_PER_TURN),
    hit_points_delta: vine.number().withoutDecimals(),
  })

const arbitrationValidator = vine.withMetaData<ValidationMeta>().create({
  intent: vine.object({
    type: vine.string().regex(REFERENCE),
    target: vine.string().maxLength(64).nullable(),
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
     * The closed list the rules document demands: the model may only name a
     * skill this character has, never one it invented.
     */
    skill_used: vine.enum((field) => (field.meta as ValidationMeta).skills).nullable(),
    difficulty: vine.enum(['easy', 'medium', 'hard', 'very_hard'] as const).nullable(),
  }),
  narration: vine.string().maxLength(4000).nullable(),
  effects: effects().nullable(),
  alert: vine.object({
    prompt_injection_suspected: vine.boolean(),
    out_of_scope: vine.boolean(),
  }),
})

const narrationValidator = vine.withMetaData<ValidationMeta>().create({
  narration: vine.string().minLength(1).maxLength(4000),
  effects: effects(),
})

export async function validateArbitration(
  payload: unknown,
  meta: ValidationMeta
): Promise<ArbitrationOutput> {
  const output = await run<ArbitrationOutput>('arbitration', arbitrationValidator, payload, meta)

  const reasons = [...coherenceReasons(output), ...effectReasons(output.effects, meta)]

  if (reasons.length > 0) {
    throw new TurnValidationError('arbitration', reasons)
  }

  return output
}

export async function validateNarration(
  payload: unknown,
  meta: ValidationMeta
): Promise<NarrationOutput> {
  const output = await run<NarrationOutput>('narration', narrationValidator, payload, meta)

  const reasons = effectReasons(output.effects, meta)

  if (reasons.length > 0) {
    throw new TurnValidationError('narration', reasons)
  }

  return output
}

/**
 * Cross-field coherence, which no per-field schema can express.
 *
 * This is where a merged arbitration call is actually policed: a model that
 * narrates the outcome of a roll it does not know is overstepping, and its
 * text has to be dropped rather than shown.
 */
function coherenceReasons(output: {
  resolution: { mode: string; skill_used: string | null; difficulty: string | null }
  narration: string | null
  effects: TurnEffects | null
}): RejectionReason[] {
  const reasons: RejectionReason[] = []
  const { mode, skill_used: skill, difficulty } = output.resolution

  if (mode === 'roll_required') {
    if (skill === null) {
      reasons.push(reason('resolution.skill_used', 'required', 'A roll needs a skill to roll on.'))
    }

    if (difficulty === null) {
      reasons.push(
        reason('resolution.difficulty', 'required', 'A roll needs a difficulty to beat.')
      )
    }

    if (output.narration !== null) {
      reasons.push(
        reason(
          'narration',
          'forbidden',
          'The outcome of the roll is not known yet, so it cannot be narrated.'
        )
      )
    }

    if (output.effects !== null) {
      reasons.push(
        reason('effects', 'forbidden', 'Effects depend on the roll and cannot be settled yet.')
      )
    }

    return reasons
  }

  if (skill !== null) {
    reasons.push(reason('resolution.skill_used', 'forbidden', 'No roll, so no skill is rolled on.'))
  }

  if (difficulty !== null) {
    reasons.push(reason('resolution.difficulty', 'forbidden', 'No roll, so no difficulty applies.'))
  }

  if (output.narration === null || output.narration.trim() === '') {
    reasons.push(
      reason('narration', 'required', 'The outcome is settled, so the turn must be narrated.')
    )
  }

  if (output.effects === null) {
    reasons.push(reason('effects', 'required', 'A narrated turn must state its effects.'))
  }

  return reasons
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
        'effects.hit_points_delta',
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

  return messages.map((entry: { field?: string; rule?: string; message?: string }) =>
    reason(entry.field ?? '*', entry.rule ?? 'invalid', entry.message ?? 'Rejected.')
  )
}

function reason(field: string, rule: string, message: string): RejectionReason {
  return { field, rule, message }
}
