import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { RulesCredit } from './rules_credit'

describe('RulesCredit', () => {
  test('credits Chaosium and the ORC License, as the licence asks', () => {
    const html = renderToStaticMarkup(<RulesCredit />)

    for (const text of ['Powered by BRP', 'Chaosium', 'ORC License']) {
      expect(html).toContain(text)
    }
  })
})
