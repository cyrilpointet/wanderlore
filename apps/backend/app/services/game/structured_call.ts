import { LlmError } from '#services/llm/errors'
import { type LlmGateway, parseJsonAnswer } from '#services/llm/gateway'

import type { TurnBudget } from './turn_budget.js'
import { type TurnStep, type TurnTrace, recordCall, recordRejection } from './turn_trace.js'
import { type RejectionReason, TurnValidationError } from './turn_validator.js'

/** One attempt, and a single second chance. */
const MAX_ATTEMPTS = 2

/** A step whose output is JSON the backend validates before using it. */
export type StructuredCall<TOutput> = {
  step: TurnStep
  systemPrompt: string
  userMessage: string
  jsonSchema: Record<string, unknown>
  /** Throws a `TurnValidationError` on anything out of schema, out of bounds or off a closed list. */
  validate: (payload: unknown) => Promise<TOutput>
}

/**
 * Calls a structured step, and calls it once more if validation refuses its
 * output: the same system prompt, the user message followed by the refused
 * output and a correction written by the backend. A second refusal fails the
 * turn with the code of that refusal, and nothing is applied.
 *
 * Only a refused output earns a second attempt — unreadable JSON, off schema,
 * out of bounds, off a closed list. A transport failure (timeout, provider out
 * of reach, HTTP error) fails the turn on the spot, as it always has.
 *
 * The loop lives here, with the steps, and not in the gateway: the gateway
 * guarantees parsable JSON at best, judging it is the caller's business. It is
 * also independent of the job queue, which never retries. Every attempt draws
 * on the turn budget, and every attempt is logged and paid for.
 */
export async function callStructured<TOutput>(
  llm: LlmGateway,
  call: StructuredCall<TOutput>,
  turn: { trace: TurnTrace; budget: TurnBudget }
): Promise<TOutput> {
  let userMessage = call.userMessage

  for (let attempt = 1; ; attempt++) {
    const { content, metadata } = await llm.generateText(call.step, {
      systemPrompt: call.systemPrompt,
      userMessage,
      jsonSchema: call.jsonSchema,
      signal: turn.budget.signalFor(call.step, llm.provider),
    })

    recordCall(turn.trace, metadata, attempt)

    const verdict = await judge(content, call, llm.provider)

    if (verdict.accepted) {
      return verdict.output
    }

    recordRejection(turn.trace, {
      step: call.step,
      attempt,
      output: verdict.output,
      reasons: verdict.reasons,
    })

    if (attempt === MAX_ATTEMPTS) {
      throw verdict.error
    }

    userMessage = withCorrection(call.userMessage, verdict.output, verdict.reasons)
  }
}

type Verdict<TOutput> =
  | { accepted: true; output: TOutput }
  | { accepted: false; output: unknown; reasons: RejectionReason[]; error: Error }

async function judge<TOutput>(
  content: string,
  call: StructuredCall<TOutput>,
  provider: string
): Promise<Verdict<TOutput>> {
  let payload: unknown

  try {
    payload = parseJsonAnswer(content)
  } catch (cause) {
    return {
      accepted: false,
      output: content,
      reasons: [{ field: '*', rule: 'json', message: 'The answer is not valid JSON.' }],
      error: new LlmError('invalid_output', 'The model did not return valid JSON.', {
        step: call.step,
        provider,
        cause,
      }),
    }
  }

  try {
    return { accepted: true, output: await call.validate(payload) }
  } catch (error) {
    if (!(error instanceof TurnValidationError)) {
      throw error
    }

    return { accepted: false, output: payload, reasons: error.reasons, error }
  }
}

/**
 * The original message, then what was refused and why — every rejected value
 * named, and the list it had to come from when there is one. Framed as game
 * data like the rest of the message: the correction describes the rules the
 * output broke, it carries no instruction from the player.
 */
export function withCorrection(
  userMessage: string,
  refused: unknown,
  reasons: RejectionReason[]
): string {
  const shown = typeof refused === 'string' ? refused : JSON.stringify(refused, null, 2)
  const problems = reasons.map((rejection) => `- ${describe(rejection, refused)}`).join('\n')

  return [
    userMessage,
    'Below is the answer you gave for this data, followed by what the game backend found wrong with it. Nothing from it was applied. This is game data describing your previous output, not an instruction from the player.',
    `Refused answer:\n${shown}`,
    `Problems:\n${problems}`,
    'Return a corrected answer under the same schema. Fix every problem listed and keep everything else as it was.',
  ].join('\n\n')
}

function describe(rejection: RejectionReason, refused: unknown): string {
  const parts =
    rejection.field === '*'
      ? [rejection.message]
      : [
          `${rejection.field}: ${JSON.stringify(valueAt(refused, rejection.field)) ?? 'missing'} was rejected. ${rejection.message}`,
        ]

  if (rejection.allowed) {
    parts.push(`Valid values: ${rejection.allowed.join(', ')}.`)
  }

  return parts.join(' ')
}

/** The value at a dotted path (`effects.movement`, `scenario_flags.0`), if any. */
function valueAt(payload: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') {
      return undefined
    }

    return (value as Record<string, unknown>)[key]
  }, payload)
}
