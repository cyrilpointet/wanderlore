import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { IssueList } from './issue_list'

describe('IssueList', () => {
  test('says each issue in words, with the field it concerns', () => {
    const html = renderToStaticMarkup(
      <IssueList
        issues={[
          { code: 'no_profession', location: 'professions' },
          { code: 'unknown_location', location: 'initialState.location', reference: 'navarre' },
        ]}
      />
    )

    expect(html).toContain('2 things to fix before publishing')
    expect(html).toContain('The world has no profession')
    expect(html).toContain('“navarre” is no named place of this world.')
    expect(html).toContain('initialState.location')
  })

  test('says a unique item given twice as a game starts', () => {
    const html = renderToStaticMarkup(
      <IssueList
        issues={[
          {
            code: 'item_given_twice',
            location: 'professions.soldier.startingItems',
            reference: 'family_sword',
          },
        ]}
      />
    )

    expect(html).toContain('“family_sword” is unique, and would be given twice')
    expect(html).toContain('professions.soldier.startingItems')
  })

  test('shows the code of an issue it has no words for yet', () => {
    const html = renderToStaticMarkup(
      <IssueList issues={[{ code: 'brand_new_issue', location: 'somewhere' }]} />
    )

    expect(html).toContain('brand_new_issue')
  })
})
