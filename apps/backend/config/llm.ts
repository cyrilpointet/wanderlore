import env from '#start/env'

import { GeminiProvider } from '#services/llm/providers/gemini_provider'
import type { LlmProvider } from '#services/llm/types'

/**
 * The single place where the LLM provider is chosen.
 *
 * Switching provider means writing an adapter under
 * `app/services/llm/providers/` and swapping the line below. Nothing else in the
 * application imports a vendor SDK.
 */
const provider: LlmProvider = new GeminiProvider({
  apiKey: env.get('GOOGLE_AI_API_KEY').release(),
  model: env.get('DEFAULT_AI_MODEL'),
})

const llmConfig = {
  provider,

  /** Hard ceiling on a single call, aborted past it and reported as a timeout. */
  requestTimeoutMs: env.get('LLM_REQUEST_TIMEOUT_MS', 60_000),
}

export default llmConfig
