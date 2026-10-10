/**
 * The real cost of play, read from `turn_log`: what the first step of the
 * budget and pricing work needs (synthesis document, budget section).
 *
 * Pure, so it can be checked on rows built by hand. Read-only by
 * construction: it takes rows, it returns numbers.
 */

/** A `turn_log` row, reduced to what the report reads. */
export type LoggedTurn = {
  sessionId: string
  language: string
  status: 'pending' | 'completed' | 'failed'
  llmUsage: Record<string, unknown>[] | null
  rejectedAttempts: Record<string, unknown>[] | null
}

/**
 * Price per million tokens, as the provider bills them. Never written in
 * code: it changes with the provider, the model and the contract. Reasoning
 * tokens are billed as output, as Gemini bills them.
 */
export type Pricing = {
  inputPerMillion: number
  outputPerMillion: number
}

export type Totals = {
  calls: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  /** Null when no pricing was given. */
  cost: number | null
}

export type StepReport = Totals & {
  step: string
  /** Calls whose output validation refused. */
  rejectedCalls: number
  /** Share of this step's calls that were refused, 0 to 1. */
  rejectionRate: number
  /** Share of this step's cost spent on refused calls, 0 to 1. Null without pricing. */
  rejectedCostShare: number | null
}

export type CostReport = {
  /** Every model the log holds calls for, whatever the filter. */
  models: string[]
  turns: { total: number; completed: number; failed: number }
  games: number
  overall: Totals
  perTurn: Totals
  perGame: Totals
  perStep: StepReport[]
  perLanguage: (Totals & { language: string; turns: number; perTurn: Totals })[]
}

type Call = {
  step: string
  attempt: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  rejected: boolean
}

/**
 * With a `model`, only that model's calls count, and only the turns that made
 * one: comparing two models means comparing the turns each one played.
 */
export function costReport(
  rows: LoggedTurn[],
  pricing: Pricing | null = null,
  model: string | null = null
): CostReport {
  /** Turns still being played have not finished spending. */
  const finished = rows.filter((row) => row.status !== 'pending')
  const settled = model === null ? finished : finished.flatMap((row) => onlyModel(row, model))
  const calls = settled.flatMap(callsOf)
  const games = new Set(settled.map((row) => row.sessionId)).size
  const overall = totalsOf(calls, pricing)

  return {
    models: modelsOf(finished),
    turns: {
      total: settled.length,
      completed: settled.filter((row) => row.status === 'completed').length,
      failed: settled.filter((row) => row.status === 'failed').length,
    },
    games,
    overall,
    perTurn: divide(overall, settled.length),
    perGame: divide(overall, games),
    perStep: stepsOf(calls, pricing),
    perLanguage: languagesOf(settled, pricing),
  }
}

/** The turn with only the calls of `model`, or nothing if it made none. */
function onlyModel(row: LoggedTurn, model: string): LoggedTurn[] {
  const usage = (row.llmUsage ?? []).filter((call) => call.model === model)

  return usage.length === 0 ? [] : [{ ...row, llmUsage: usage }]
}

function modelsOf(rows: LoggedTurn[]): string[] {
  const models = rows.flatMap((row) => (row.llmUsage ?? []).map((call) => call.model))

  return [...new Set(models.filter((model): model is string => typeof model === 'string'))].sort()
}

/**
 * The calls of a turn, each tagged with whether validation refused it.
 * Rows logged before attempts were numbered count as first attempts.
 */
function callsOf(row: LoggedTurn): Call[] {
  const refused = new Set(
    (row.rejectedAttempts ?? []).map((attempt) => `${attempt.step}:${attempt.attempt}`)
  )

  return (row.llmUsage ?? []).map((usage) => {
    const step = String(usage.step)
    const attempt = typeof usage.attempt === 'number' ? usage.attempt : 1

    return {
      step,
      attempt,
      inputTokens: tokens(usage.input_tokens),
      outputTokens: tokens(usage.output_tokens),
      reasoningTokens: tokens(usage.reasoning_tokens),
      totalTokens: tokens(usage.total_tokens),
      rejected: refused.has(`${step}:${attempt}`),
    }
  })
}

function tokens(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function costOf(calls: Call[], pricing: Pricing | null): number | null {
  if (pricing === null) {
    return null
  }

  return calls.reduce(
    (cost, call) =>
      cost +
      (call.inputTokens * pricing.inputPerMillion +
        (call.outputTokens + call.reasoningTokens) * pricing.outputPerMillion) /
        1_000_000,
    0
  )
}

function totalsOf(calls: Call[], pricing: Pricing | null): Totals {
  return {
    calls: calls.length,
    inputTokens: sum(calls, 'inputTokens'),
    outputTokens: sum(calls, 'outputTokens'),
    reasoningTokens: sum(calls, 'reasoningTokens'),
    totalTokens: sum(calls, 'totalTokens'),
    cost: costOf(calls, pricing),
  }
}

function sum(
  calls: Call[],
  key: 'inputTokens' | 'outputTokens' | 'reasoningTokens' | 'totalTokens'
) {
  return calls.reduce((total, call) => total + call[key], 0)
}

/** An average, over turns or games. Zero of them averages to zero, not to NaN. */
function divide(totals: Totals, count: number): Totals {
  const by = (value: number) => (count === 0 ? 0 : value / count)

  return {
    calls: by(totals.calls),
    inputTokens: by(totals.inputTokens),
    outputTokens: by(totals.outputTokens),
    reasoningTokens: by(totals.reasoningTokens),
    totalTokens: by(totals.totalTokens),
    cost: totals.cost === null ? null : by(totals.cost),
  }
}

/** In pipeline order, then any other step the log holds. */
const STEP_ORDER = ['arbitration', 'narration', 'extraction']

function stepsOf(calls: Call[], pricing: Pricing | null): StepReport[] {
  const steps = [...new Set(calls.map((call) => call.step))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  )

  return steps.map((step) => {
    const ofStep = calls.filter((call) => call.step === step)
    const refused = ofStep.filter((call) => call.rejected)
    const totals = totalsOf(ofStep, pricing)
    const refusedCost = costOf(refused, pricing) ?? 0

    return {
      step,
      ...totals,
      rejectedCalls: refused.length,
      rejectionRate: ofStep.length === 0 ? 0 : refused.length / ofStep.length,
      rejectedCostShare:
        totals.cost === null ? null : totals.cost === 0 ? 0 : refusedCost / totals.cost,
    }
  })
}

function rank(step: string): number {
  const index = STEP_ORDER.indexOf(step)

  return index === -1 ? STEP_ORDER.length : index
}

/**
 * English tokenises densest: the same turn costs more in another language,
 * so an average over every language would understate the others.
 */
function languagesOf(rows: LoggedTurn[], pricing: Pricing | null): CostReport['perLanguage'] {
  const languages = [...new Set(rows.map((row) => row.language))].sort()

  return languages.map((language) => {
    const turns = rows.filter((row) => row.language === language)
    const totals = totalsOf(turns.flatMap(callsOf), pricing)

    return { language, turns: turns.length, ...totals, perTurn: divide(totals, turns.length) }
  })
}
