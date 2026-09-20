import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Checks that the configured LLM provider is reachable and correctly credentialed,
 * exercising both the structured and the streaming paths of the gateway.
 *
 * Costs a handful of tokens per run.
 */
export default class LlmPing extends BaseCommand {
  static commandName = 'llm:ping'
  static description = 'Verify that the configured LLM provider answers'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { default: llm, LlmError } = await import('#services/llm')

    this.logger.info(`provider: ${llm.provider} · model: ${llm.model}`)

    try {
      await this.#checkStructured(llm)
      await this.#checkStreaming(llm)
    } catch (error) {
      if (error instanceof LlmError) {
        this.logger.error(`[${error.category}] ${error.message}`)
        this.exitCode = 1
        return
      }
      throw error
    }

    this.logger.success('LLM provider answered on both paths')
  }

  async #checkStructured(llm: (typeof import('#services/llm'))['default']) {
    const { content, metadata } = await llm.generateJson<{ status: string }>('arbitration', {
      systemPrompt: 'You are a health check. Answer with the requested JSON only.',
      userMessage: 'Set "status" to "ok".',
      jsonSchema: {
        type: 'object',
        properties: { status: { type: 'string' } },
        required: ['status'],
      },
    })

    this.logger.info(
      `structured: ${JSON.stringify(content)} ` +
        `(${metadata.usage.totalTokens} tokens, ${metadata.durationMs}ms)`
    )
  }

  async #checkStreaming(llm: (typeof import('#services/llm'))['default']) {
    const stream = llm.streamText('narration', {
      systemPrompt: 'You are a health check. Answer in one short sentence.',
      userMessage: 'Confirm that streaming works.',
    })

    let chunks = 0
    let next = await stream.next()
    while (!next.done) {
      chunks++
      next = await stream.next()
    }

    const metadata = next.value
    this.logger.info(
      `streaming: ${chunks} chunk(s) ` +
        `(${metadata.usage.totalTokens} tokens, ${metadata.durationMs}ms)`
    )
  }
}
