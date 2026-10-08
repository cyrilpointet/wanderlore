import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * The real cost of play, read from `turn_log`: tokens per turn, per game and
 * per step, the share spent on refused attempts, and the split by language.
 *
 * Read-only. Prices are never written in code: they change with the provider,
 * the model and the contract, so they come in as options, per million tokens.
 * Without them the report gives tokens only.
 */
export default class LlmCost extends BaseCommand {
  static commandName = 'llm:cost'
  static description = 'Report the real LLM cost per turn, per game and per step'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Price of a million input tokens' })
  declare inputPerMillion?: number

  @flags.number({ description: 'Price of a million output tokens (reasoning billed alike)' })
  declare outputPerMillion?: number

  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { costReport } = await import('#services/game/cost_report')

    const rows = await db
      .from('turn_log')
      .select('session_id', 'language', 'status', 'llm_usage', 'rejected_attempts')

    const pricing =
      this.inputPerMillion === undefined || this.outputPerMillion === undefined
        ? null
        : { inputPerMillion: this.inputPerMillion, outputPerMillion: this.outputPerMillion }

    const report = costReport(
      rows.map((row) => ({
        sessionId: row.session_id,
        language: row.language,
        status: row.status,
        llmUsage: row.llm_usage,
        rejectedAttempts: row.rejected_attempts,
      })),
      pricing
    )

    if (pricing === null) {
      this.logger.info(
        'No pricing given: tokens only. Pass --input-per-million and --output-per-million for a cost.'
      )
    }

    this.logger.info(
      `${report.turns.total} turn(s) played (${report.turns.completed} completed, ${report.turns.failed} failed) across ${report.games} game(s)`
    )

    const tableOf = (title: string, head: string[], lines: string[][]) => {
      this.logger.log('')
      this.logger.log(this.colors.bold(title))
      const table = this.ui.table().head(head)
      lines.forEach((line) => table.row(line))
      table.render()
    }

    tableOf(
      'Averages',
      ['', 'calls', 'input', 'output', 'reasoning', 'total', 'cost'],
      [
        ['per turn', ...figures(report.perTurn)],
        ['per game', ...figures(report.perGame)],
        ['overall', ...figures(report.overall)],
      ]
    )

    tableOf(
      'Per step',
      ['step', 'calls', 'input', 'output', 'reasoning', 'total', 'cost', 'refused', 'refused cost'],
      report.perStep.map((step) => [
        step.step,
        ...figures(step),
        percent(step.rejectionRate),
        step.rejectedCostShare === null ? '—' : percent(step.rejectedCostShare),
      ])
    )

    tableOf(
      'Per language, per turn',
      ['language', 'turns', 'calls', 'input', 'output', 'reasoning', 'total', 'cost'],
      report.perLanguage.map((language) => [
        language.language,
        String(language.turns),
        ...figures(language.perTurn),
      ])
    )
  }
}

function figures(totals: {
  calls: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  cost: number | null
}): string[] {
  const round = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

  return [
    round(totals.calls),
    round(totals.inputTokens),
    round(totals.outputTokens),
    round(totals.reasoningTokens),
    round(totals.totalTokens),
    totals.cost === null ? '—' : totals.cost.toFixed(4),
  ]
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`
}
