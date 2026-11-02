import { test } from '@japa/runner'

import {
  SCENES_BEFORE_FOLD,
  SCENE_SUMMARY_THRESHOLD,
  TURNS_KEPT_VERBATIM,
  type StoredSummary,
  coveredUpTo,
  memoryOf,
  sceneToSummarise,
  scenesToFold,
  storySoFar,
} from '#services/game/narrative_memory'

function scene(start: number, end: number): StoredSummary {
  return { level: 'scene', content: `scene ${start}-${end}`, turnStart: start, turnEnd: end }
}

function global(end: number): StoredSummary {
  return { level: 'global', content: `global 1-${end}`, turnStart: 1, turnEnd: end }
}

test.group('Narrative memory | what a turn reads', () => {
  test('reads the latest global summary, then the scenes it has not folded', ({ assert }) => {
    const memory = memoryOf([scene(9, 16), global(8), scene(1, 8), scene(17, 24), global(16)])

    assert.deepEqual(storySoFar(memory), ['global 1-16', 'scene 17-24'])
    assert.equal(coveredUpTo(memory), 24)
  })

  test('orders the scenes oldest first, whatever order they were read in', ({ assert }) => {
    const memory = memoryOf([scene(17, 24), scene(1, 8), scene(9, 16)])

    assert.deepEqual(storySoFar(memory), ['scene 1-8', 'scene 9-16', 'scene 17-24'])
  })

  test('covers nothing before the first summary', ({ assert }) => {
    const memory = memoryOf([])

    assert.deepEqual(storySoFar(memory), [])
    assert.equal(coveredUpTo(memory), 0)
  })

  test('covers up to the global summary when no scene follows it', ({ assert }) => {
    assert.equal(coveredUpTo(memoryOf([scene(1, 8), global(8)])), 8)
  })
})

test.group('Narrative memory | when a scene is due', () => {
  test('starts from settled values', ({ assert }) => {
    assert.equal(SCENE_SUMMARY_THRESHOLD, 8)
    assert.equal(SCENES_BEFORE_FOLD, 4)
    assert.equal(TURNS_KEPT_VERBATIM, 4)
  })

  test('waits for enough turns older than the last ones', ({ assert }) => {
    const memory = memoryOf([])

    /** Eleven turns: seven older than the last four, one short. */
    assert.isNull(sceneToSummarise(memory, 11))
    assert.deepEqual(sceneToSummarise(memory, 12), { start: 1, end: 8 })
  })

  test('never summarises the last turns', ({ assert }) => {
    const range = sceneToSummarise(memoryOf([scene(1, 8)]), 20)

    assert.deepEqual(range, { start: 9, end: 20 - TURNS_KEPT_VERBATIM })
  })

  test('catches up in one go when the job fell behind', ({ assert }) => {
    assert.deepEqual(sceneToSummarise(memoryOf([scene(1, 8)]), 40), { start: 9, end: 36 })
  })

  test('starts after the global summary when no scene follows it', ({ assert }) => {
    assert.deepEqual(sceneToSummarise(memoryOf([global(16)]), 28), { start: 17, end: 24 })
  })
})

test.group('Narrative memory | when scenes are folded', () => {
  test('keeps up to the limit of scenes beside the global summary', ({ assert }) => {
    const four = [scene(1, 8), scene(9, 16), scene(17, 24), scene(25, 32)]

    assert.deepEqual(scenesToFold(memoryOf(four)), [])
  })

  test('folds the oldest scenes past the limit', ({ assert }) => {
    const memory = memoryOf([
      global(8),
      scene(9, 16),
      scene(17, 24),
      scene(25, 32),
      scene(33, 40),
      scene(41, 48),
    ])

    assert.deepEqual(scenesToFold(memory), [scene(9, 16)])
  })
})
