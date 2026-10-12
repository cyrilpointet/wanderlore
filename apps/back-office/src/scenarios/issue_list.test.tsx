import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { IssueList } from './issue_list'

describe('IssueList', () => {
  test('says each issue in words, with the field it concerns', () => {
    const html = renderToStaticMarkup(
      <IssueList
        issues={[
          { code: 'missing_character', location: 'pregeneratedCharacter' },
          { code: 'unknown_location', location: 'initialState.location', reference: 'navarre' },
        ]}
      />
    )

    expect(html).toContain('2 things to fix before publishing')
    expect(html).toContain('No character to play yet.')
    expect(html).toContain('“navarre” is no named place of this world.')
    expect(html).toContain('initialState.location')
  })

  test('shows the code of an issue it has no words for yet', () => {
    const html = renderToStaticMarkup(
      <IssueList issues={[{ code: 'brand_new_issue', location: 'somewhere' }]} />
    )

    expect(html).toContain('brand_new_issue')
  })
})
