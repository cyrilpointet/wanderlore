import { test } from '@japa/runner'

import { LOVECRAFT_MYTHOS_CONTENT } from '#database/content/lovecraft_mythos'
import { checkScenario } from '#services/game/content/coherence'

const { scenarios, ...MYTHOS } = LOVECRAFT_MYTHOS_CONTENT
const WRECK = scenarios.find(({ reference }) => reference === 'the_wreck_of_the_sovereign')!

test.group('The Wreck of the Sovereign', () => {
  test('holds together', ({ assert }) => {
    assert.deepEqual(checkScenario(MYTHOS, WRECK), [])
  })

  test('the landing party comes ashore with the character; the drowned wait where they lie', ({
    assert,
  }) => {
    const placed = Object.fromEntries(
      WRECK.npcs
        .filter(({ initialLocation }) => initialLocation !== null)
        .map(({ reference, initialLocation }) => [reference, initialLocation])
    )

    assert.equal(WRECK.initialState!.location, 'black_sand_beach')
    assert.deepEqual(placed, {
      bosun_mcrae: 'black_sand_beach',
      tomas_reyes: 'black_sand_beach',
      professor_whitcombe: 'black_sand_beach',
      captain_voss: 'sovereign_wreck',
      the_drowned_priest: 'drowned_temple',
    })
  })
})
