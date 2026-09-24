import { test } from '@japa/runner'

import { ContentLabels, MissingLabelError } from '#services/game/content_labels'
import { THREE_MUSKETEERS, type ContentEntry } from '#services/game/world'

const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

const CONTENT: [string, ContentEntry[]][] = [
  ['attributes', THREE_MUSKETEERS.attributes],
  ['skills', THREE_MUSKETEERS.skills],
  ['resources', THREE_MUSKETEERS.resources],
  ['locations', THREE_MUSKETEERS.locations],
  ['chapters', THREE_MUSKETEERS.chapters],
  ['quests', THREE_MUSKETEERS.quests],
]

test.group('World definition | content', () => {
  for (const [kind, entries] of CONTENT) {
    test(`every ${kind} entry has a stable reference and a label`, ({ assert }) => {
      for (const entry of entries) {
        assert.match(entry.reference, REFERENCE)
        assert.isNotEmpty(entry.label.trim())
      }
    })

    test(`${kind} references are unique`, ({ assert }) => {
      const references = entries.map((entry) => entry.reference)

      assert.lengthOf(new Set(references), references.length)
    })
  }

  test('every skill hangs off an attribute the world defines', ({ assert }) => {
    const attributes = THREE_MUSKETEERS.attributes.map((attribute) => attribute.reference)

    for (const skill of THREE_MUSKETEERS.skills) {
      assert.include(attributes, skill.attribute)
    }
  })
})

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
})
