import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import NarrativeSummary from '#models/narrative_summary'
import { LlmError } from '#services/llm/errors'
import { LlmGateway } from '#services/llm/gateway'
import { EmptySummaryError, SummaryService, loadMemory } from '#services/game/summary_service'
import { storySoFar } from '#services/game/narrative_memory'
import { FakeLlmProvider, rawAnswer } from '#tests/helpers/fake_llm_provider'
import {
  countRows,
  createSession,
  createSummary,
  createUser,
  useTransaction,
} from '#tests/helpers/database'

/** What arbitration knew and the narrator never did: it must never reach a summary. */
const SECRET = 'The abbess reports to the Cardinal.'

/** Completed turns 1 to `count`, each with its action, its narration and its ruling. */
async function playedTurns(sessionId: string, count: number) {
  for (let number = 1; number <= count; number++) {
    await db.table('turn_log').insert({
      session_id: sessionId,
      turn_number: number,
      status: 'completed',
      player_input: `Action ${number}`,
      narrated_text: `Narration ${number}`,
      arbitration_output: { validity: { justification: SECRET } },
      created_at: new Date(),
    })
  }
}

function buildService(answers: unknown[], options: { error?: Error } = {}) {
  const provider = new FakeLlmProvider({
    jsonSequence: answers,
    usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
    ...options,
  })
  const service = new SummaryService(new LlmGateway(provider, { requestTimeoutMs: 1000 }))

  return { provider, service }
}

async function arrangeGame(turns: number) {
  const sessionId = await createSession(await createUser())
  await playedTurns(sessionId, turns)

  return sessionId
}

test.group('SummaryService | a scene', (group) => {
  useTransaction(group)

  test('condenses every turn no summary covers but the last ones', async ({ assert }) => {
    const sessionId = await arrangeGame(20)
    const { provider, service } = buildService([rawAnswer('  He crossed Paris.  ')])

    const [summary] = await service.summarise(sessionId)

    assert.equal(summary.level, 'scene')
    assert.equal(summary.content, 'He crossed Paris.')
    assert.equal(summary.turnStart, 1)
    assert.equal(summary.turnEnd, 16)

    const message = provider.requests[0].userMessage
    assert.include(message, 'Action 1')
    assert.include(message, 'Narration 16')
    /** The last four stay verbatim for the narrator. */
    assert.notInclude(message, 'Action 17')
  })

  test('records what the call cost', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    const { service } = buildService([rawAnswer('He crossed Paris.')])

    const [summary] = await service.summarise(sessionId)

    assert.deepInclude(summary.llmUsage[0], {
      step: 'summary',
      attempt: 1,
      input_tokens: 900,
      output_tokens: 120,
    })
  })

  test('reads the actions and the narration, never the ruling', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    const { provider, service } = buildService([rawAnswer('He crossed Paris.')])

    await service.summarise(sessionId)

    assert.notInclude(provider.requests[0].userMessage, SECRET)
    assert.equal(provider.requests[0].step, 'summary')
  })

  test('hands over what earlier summaries hold, as context', async ({ assert }) => {
    const sessionId = await arrangeGame(20)
    await createSummary(sessionId, { start: 1, end: 8 }, 'scene', 'He reached Paris.')
    const { provider, service } = buildService([rawAnswer('He met Tréville.')])

    const [summary] = await service.summarise(sessionId)

    assert.equal(summary.turnStart, 9)
    assert.include(provider.requests[0].userMessage, 'He reached Paris.')
    assert.notInclude(provider.requests[0].userMessage, 'Action 8"')
  })

  test('writes nothing below the threshold', async ({ assert }) => {
    const sessionId = await arrangeGame(11)
    const { provider, service } = buildService([])

    assert.deepEqual(await service.summarise(sessionId), [])
    assert.lengthOf(provider.requests, 0)
  })

  test('writes once when asked twice', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    const { provider, service } = buildService([rawAnswer('He crossed Paris.')])

    await service.summarise(sessionId)
    await service.summarise(sessionId)

    assert.lengthOf(provider.requests, 1)
    assert.equal(await countRows('narrative_summaries', { session_id: sessionId }), 1)
  })

  test('leaves a game the player deleted alone', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    await db.from('sessions').where('id', sessionId).update({ deleted_at: DateTime.now().toSQL() })
    const { provider, service } = buildService([])

    assert.deepEqual(await service.summarise(sessionId), [])
    assert.lengthOf(provider.requests, 0)
  })
})

test.group('SummaryService | the global summary', (group) => {
  useTransaction(group)

  test('folds the oldest scene once there are too many', async ({ assert }) => {
    const sessionId = await arrangeGame(44)
    for (const [start, end] of [
      [1, 8],
      [9, 16],
      [17, 24],
      [25, 32],
    ]) {
      await createSummary(sessionId, { start, end }, 'scene', `Scene ${start}-${end}.`)
    }
    const { provider, service } = buildService([
      rawAnswer('Scene 33-40.'),
      rawAnswer('The story up to turn 8.'),
    ])

    const [scene, global] = await service.summarise(sessionId)

    assert.deepInclude(scene.$attributes, { level: 'scene', turnStart: 33, turnEnd: 40 })
    assert.deepInclude(global.$attributes, { level: 'global', turnStart: 1, turnEnd: 8 })
    assert.include(provider.requests[1].userMessage, 'Scene 1-8.')
    assert.notInclude(provider.requests[1].userMessage, 'Scene 9-16.')

    /** What the next turn reads: the global summary, then the four scenes after it. */
    assert.deepEqual(storySoFar(await loadMemory(sessionId)), [
      'The story up to turn 8.',
      'Scene 9-16.',
      'Scene 17-24.',
      'Scene 25-32.',
      'Scene 33-40.',
    ])
  })

  test('merges the previous global summary with the scenes it folds', async ({ assert }) => {
    const sessionId = await arrangeGame(52)
    await createSummary(sessionId, { start: 1, end: 8 }, 'global', 'The story up to turn 8.')
    for (const [start, end] of [
      [9, 16],
      [17, 24],
      [25, 32],
      [33, 40],
    ]) {
      await createSummary(sessionId, { start, end }, 'scene', `Scene ${start}-${end}.`)
    }
    const { provider, service } = buildService([
      rawAnswer('Scene 41-48.'),
      rawAnswer('The story up to turn 16.'),
    ])

    const [, global] = await service.summarise(sessionId)

    assert.equal(global.turnEnd, 16)
    assert.include(provider.requests[1].userMessage, 'The story up to turn 8.')
    assert.include(provider.requests[1].userMessage, 'Scene 9-16.')
  })
})

test.group('SummaryService | a summary that fails', (group) => {
  useTransaction(group)

  test('writes nothing when the model cannot be reached', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    const { service } = buildService([], {
      error: new LlmError('provider_unreachable', 'The provider is down.', {
        step: 'summary',
        provider: 'fake',
      }),
    })

    await assert.rejects(() => service.summarise(sessionId))
    assert.equal(await countRows('narrative_summaries', { session_id: sessionId }), 0)
  })

  test('writes nothing when the model answers nothing', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    const { service } = buildService([rawAnswer('   ')])

    await assert.rejects(() => service.summarise(sessionId), EmptySummaryError)
    assert.equal(await NarrativeSummary.query().where('sessionId', sessionId).first(), null)
  })
})
