import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { WorldList } from './world_list'

describe('WorldList', () => {
  test('lists each world by its English name, its reference and its scenarios', () => {
    const html = renderToStaticMarkup(
      <WorldList
        worlds={[
          {
            id: 'w1',
            reference: 'three_musketeers',
            labels: { en: 'The Three Musketeers', fr: 'Les Trois Mousquetaires' },
            scenarioCount: 1,
            updatedAt: null,
          },
          {
            id: 'w2',
            reference: 'baker_street',
            labels: { en: 'Baker Street' },
            scenarioCount: 3,
            updatedAt: null,
          },
        ]}
      />
    )

    for (const text of ['The Three Musketeers', 'three_musketeers', '1 scenario', '3 scenarios']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('Les Trois Mousquetaires')
  })

  test('says when there is no world yet', () => {
    expect(renderToStaticMarkup(<WorldList worlds={[]} />)).toContain('No world yet.')
  })
})
