import llm from '#services/llm'

import { SummaryService } from './game/summary_service.js'

/**
 * Application-wide summary service.
 *
 * ```ts
 * import summaries from '#services/summary'
 * ```
 *
 * Tests build their own `new SummaryService(gateway)` around a fake provider —
 * importing this barrel would construct a real Gemini client.
 */
const summaries = new SummaryService(llm)

export default summaries

export { SUMMARISE_QUEUE, SummaryService } from './game/summary_service.js'
export type { SummariseJob } from './game/summary_service.js'
