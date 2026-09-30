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

  test('labels a unique place by its definition, under its handle', ({ assert }) => {
    const place = {
      handle: 'paris',
      definitionReference: 'paris',
      parentReference: null,
      name: null,
    }

    assert.deepEqual(labels.location(place), { reference: 'paris', label: 'Paris' })
  })

  test('labels an improvised place by its proper name', ({ assert }) => {
    const place = {
      handle: 'town_1',
      definitionReference: 'town',
      parentReference: 'france',
      name: 'Orléans',
    }

    assert.deepEqual(labels.location(place), { reference: 'town_1', label: 'Orléans' })
  })

  test('labels a nameless place by its archetype within its parent', ({ assert }) => {
    const place = {
      handle: 'tavern_2',
      definitionReference: 'tavern',
      parentReference: 'meung_sur_loire',
      name: null,
    }

    assert.deepEqual(labels.location(place), {
      reference: 'tavern_2',
      label: 'Tavern · Meung-sur-Loire',
    })
  })

  test('fails loudly on a place it cannot label', ({ assert }) => {
    const place = {
      handle: 'lair_1',
      definitionReference: 'lair',
      parentReference: 'paris',
      name: null,
    }
    const orphan = {
      handle: 'tavern_1',
      definitionReference: 'tavern',
      parentReference: 'nowhere',
      name: null,
    }

    assert.throws(() => labels.location(place), MissingLabelError)
    assert.throws(() => labels.location({ ...place, name: 'The Lair' }), MissingLabelError)
    assert.throws(() => labels.location(orphan), MissingLabelError)
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
