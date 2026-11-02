import Session from '#models/session'
import TurnLog from '#models/turn_log'
import NarrativeSummary from '#models/narrative_summary'
import type { LlmGateway } from '#services/llm/gateway'

import {
  type Memory,
  type SummaryLevel,
  type TurnRange,
  memoryOf,
  sceneToSummarise,
  scenesToFold,
  storySoFar,
} from './narrative_memory.js'
import {
  GLOBAL_SUMMARY_SYSTEM_PROMPT,
  SCENE_SUMMARY_SYSTEM_PROMPT,
  buildGlobalSummaryMessage,
  buildSceneSummaryMessage,
} from './prompts/summary.js'
import { usageRow } from './turn_trace.js'

/** The queue summaries are written from, apart from the turns' own. */
export const SUMMARISE_QUEUE = 'narrative-summary'

/** The job carries the game's id and nothing else: what is due is read when it runs. */
export type SummariseJob = {
  sessionId: string
}

/** The model answered nothing: nothing is written, and the next turn asks again. */
export class EmptySummaryError extends Error {
  constructor(level: SummaryLevel) {
    super(`The model returned an empty ${level} summary.`)
  }
}

/** The summaries of a game, as a turn and the summary job read them. */
export async function loadMemory(sessionId: string): Promise<Memory> {
  const summaries = await NarrativeSummary.query()
    .where('sessionId', sessionId)
    .select('level', 'content', 'turnStart', 'turnEnd')

  return memoryOf(summaries)
}

/**
 * Writes what the memory of a game is due: a scene summary once enough turns
 * have gone uncovered, then a new global summary once there are too many
 * scenes. Run by a job, never on a turn's critical path.
 *
 * No second attempt and no event: a summary that fails writes nothing, and
 * the next turn, finding the threshold still reached, asks again. The player
 * never sees it.
 */
export class SummaryService {
  #llm: LlmGateway

  constructor(llm: LlmGateway) {
    this.#llm = llm
  }

  /**
   * Works out what is due when it runs, not when it was asked for: two jobs
   * queued for the same game write once. A game the player deleted is left
   * alone. Returns the summaries written.
   */
  async summarise(sessionId: string): Promise<NarrativeSummary[]> {
    const session = await Session.query()
      .where('id', sessionId)
      .withScopes((scopes) => scopes.listed())
      .first()

    if (!session) {
      return []
    }

    const written: NarrativeSummary[] = []
    let memory = await loadMemory(sessionId)
    const scene = sceneToSummarise(memory, await lastTurnOf(sessionId))

    if (scene !== null) {
      written.push(await this.#summariseScene(sessionId, memory, scene))
      memory = await loadMemory(sessionId)
    }

    const toFold = scenesToFold(memory)

    if (toFold.length > 0) {
      written.push(await this.#fold(sessionId, memory, toFold))
    }

    return written
  }

  async #summariseScene(
    sessionId: string,
    memory: Memory,
    range: TurnRange
  ): Promise<NarrativeSummary> {
    /**
     * The player's actions and the narration, nothing else of the turn: the
     * arbitration's output is shaped by the secret lore, which the narrator —
     * and so this summary — must never hold.
     */
    const turns = await TurnLog.query()
      .where('sessionId', sessionId)
      .withScopes((scopes) => scopes.completed())
      .whereBetween('turnNumber', [range.start, range.end])
      .orderBy('turnNumber', 'asc')
      .select('turnNumber', 'playerInput', 'narratedText')

    return this.#write(sessionId, 'scene', range, {
      systemPrompt: SCENE_SUMMARY_SYSTEM_PROMPT,
      userMessage: buildSceneSummaryMessage({
        storySoFar: storySoFar(memory),
        turns: turns.map((turn) => ({
          turn: turn.turnNumber!,
          player_input: turn.playerInput,
          narration: turn.narratedText ?? '',
        })),
      }),
    })
  }

  /** The new global summary covers the story from its first turn to the last scene it folds. */
  async #fold(
    sessionId: string,
    memory: Memory,
    scenes: Memory['scenes']
  ): Promise<NarrativeSummary> {
    return this.#write(
      sessionId,
      'global',
      { start: 1, end: scenes.at(-1)!.turnEnd },
      {
        systemPrompt: GLOBAL_SUMMARY_SYSTEM_PROMPT,
        userMessage: buildGlobalSummaryMessage({
          previous: memory.global?.content ?? null,
          scenes: scenes.map(({ content }) => content),
        }),
      }
    )
  }

  async #write(
    sessionId: string,
    level: SummaryLevel,
    range: TurnRange,
    prompt: { systemPrompt: string; userMessage: string }
  ): Promise<NarrativeSummary> {
    const { content, metadata } = await this.#llm.generateText('summary', prompt)
    const summary = content.trim()

    if (summary === '') {
      throw new EmptySummaryError(level)
    }

    return NarrativeSummary.create({
      sessionId,
      level,
      content: summary,
      turnStart: range.start,
      turnEnd: range.end,
      llmUsage: [usageRow(metadata)],
    })
  }
}

/** Only completed turns hold a number, so the highest one is the last of the story. */
async function lastTurnOf(sessionId: string): Promise<number> {
  const last = await TurnLog.query().where('sessionId', sessionId).max('turn_number as max').first()

  return Number(last?.$extras.max ?? 0)
}
