import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { WorldRow } from './world_list'

describe('WorldRow', () => {
  test('shows a world by its English name, its reference and its scenarios', () => {
    const html = renderToStaticMarkup(
      <WorldRow
        world={{
          id: 'w1',
          reference: 'three_musketeers',
          labels: { en: 'The Three Musketeers', fr: 'Les Trois Mousquetaires' },
          scenarioCount: 1,
          updatedAt: null,
        }}
      />
    )

    for (const text of ['The Three Musketeers', 'three_musketeers', '1 scenario']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('Les Trois Mousquetaires')
  })

  test('counts scenarios in the plural', () => {
    const html = renderToStaticMarkup(
      <WorldRow
        world={{ id: 'w2', reference: 'baker_street', labels: { en: 'Baker Street' }, scenarioCount: 3, updatedAt: null }}
      />
    )

    expect(html).toContain('3 scenarios')
  })
})
