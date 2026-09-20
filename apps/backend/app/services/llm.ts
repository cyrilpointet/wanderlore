import llmConfig from '#config/llm'

import { LlmGateway } from './llm/gateway.js'

/**
 * Application-wide LLM Gateway instance.
 *
 * Import this, never a provider or a vendor SDK:
 *
 * ```ts
 * import llm from '#services/llm'
 * ```
 */
const llm = new LlmGateway(llmConfig.provider, {
  requestTimeoutMs: llmConfig.requestTimeoutMs,
})

export default llm

export { LlmError } from './llm/errors.js'
export type { LlmErrorCategory } from './llm/errors.js'
export type { LlmCallMetadata, LlmResult, LlmStep, LlmUsage } from './llm/types.js'
