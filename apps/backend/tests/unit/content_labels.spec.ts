import { test } from '@japa/runner'

import { ContentLabels, MissingLabelError } from '#services/game/content_labels'
import { THREE_MUSKETEERS } from '#services/game/world'

test.group('Content labels', () => {
  const labels = new ContentLabels(THREE_MUSKETEERS)

  test('pairs a reference with its label', ({ assert }) => {
    assert.deepEqual(labels.of('location', 'meung_sur_loire'), {
      reference: 'meung_sur_loire',
      label: 'Meung-sur-Loire',
    })
  })

  test('labels the world itself', ({ assert }) => {
    assert.deepEqual(labels.world(), {
      reference: 'three_musketeers',
      label: 'The Three Musketeers',
    })
  })

  test('fails loudly on a reference it cannot label', ({ assert }) => {
    /**
     * Never the raw reference, never a prettified one: either would hide state
     * written against a list it does not belong to.
     */
    assert.throws(() => labels.of('location', 'noble_quarter'), MissingLabelError)
  })

  test('looks a reference up in its own kind only', ({ assert }) => {
    assert.throws(() => labels.of('skill', 'meung_sur_loire'), MissingLabelError)
  })

  test('labels people of the world', ({ assert }) => {
    assert.deepEqual(labels.of('npc', 'treville'), {
      reference: 'treville',
      label: 'M. de Tréville',
    })
    assert.deepEqual(labels.of('npc', 'commoner'), { reference: 'commoner', label: 'Commoner' })
  })

  test('keeps unique places and place archetypes apart', ({ assert }) => {
    /** An archetype is never a place the player stands in, only what one is an instance of. */
    assert.deepEqual(labels.of('location_archetype', 'tavern'), {
      reference: 'tavern',
      label: 'Tavern',
    })
    assert.throws(() => labels.of('location', 'tavern'), MissingLabelError)
    assert.throws(() => labels.of('location_archetype', 'paris'), MissingLabelError)
  })
})
