import { test } from '@japa/runner'

import { ContentLabels } from '#services/game/content_labels'
import { type MetPerson, Opponents } from '#services/game/opponents'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'

/**
 * Whom the character fought, as the player is told (roadmap, Phase 10): by
 * name when the character knows it, else as the n-th unknown — a rank that
 * never moves.
 */

const labels = new ContentLabels(THREE_MUSKETEERS)

/** In the order the game brought them in. */
const PEOPLE: MetPerson[] = [
  { handle: 'athos', definitionReference: 'athos', name: null },
  { handle: 'jussac', definitionReference: 'jussac', name: null },
  { handle: 'cardinal_guard_1', definitionReference: 'cardinal_guard', name: null },
  { handle: 'rochefort', definitionReference: 'rochefort', name: null },
  { handle: 'cardinal_guard_2', definitionReference: 'cardinal_guard', name: 'Biscarat' },
]

function opponents(now: string[]) {
  return new Opponents(labels, THREE_MUSKETEERS, PEOPLE, { initially: ['athos'], now })
}

test.group('Opponents', () => {
  test('names a unique person the character knows', ({ assert }) => {
    assert.deepEqual(opponents(['athos']).of('athos'), {
      reference: 'athos',
      label: 'Athos',
      rank: null,
    })
  })

  test('ranks the unknown in the order they came in, leaving out those known from the start', ({
    assert,
  }) => {
    const known = opponents(['athos'])

    assert.deepEqual(known.of('jussac'), { reference: 'jussac', label: null, rank: 1 })
    assert.deepEqual(known.of('rochefort'), { reference: 'rochefort', label: null, rank: 2 })
  })

  test('keeps a rank when someone before gives their name', ({ assert }) => {
    const known = opponents(['athos', 'jussac'])

    assert.equal(known.of('jussac').label, 'Jussac')
    assert.deepEqual(known.of('rochefort'), { reference: 'rochefort', label: null, rank: 2 })
  })

  test('names an archetype by the name given in play, or else by its definition', ({ assert }) => {
    const known = opponents(['athos'])

    assert.deepEqual(known.of('cardinal_guard_1'), {
      reference: 'cardinal_guard_1',
      label: "Cardinal's Guard",
      rank: null,
    })
    assert.equal(known.of('cardinal_guard_2').label, 'Biscarat')
  })

  test('names an opponent the round brings in by its archetype', ({ assert }) => {
    assert.deepEqual(opponents([]).of('commoner_1', 'commoner'), {
      reference: 'commoner_1',
      label: 'Commoner',
      rank: null,
    })
  })
})
