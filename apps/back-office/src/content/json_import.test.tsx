import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { JsonImport } from './json_import'

describe('JsonImport', () => {
  test('a button for a JSON file, and what the file should hold', () => {
    const html = renderToStaticMarkup(
      <JsonImport hint="A world as the server sends it." onImport={() => {}} />
    )

    expect(html).toContain('Fill in from a JSON file')
    expect(html).toMatch(/type="file"[^>]*accept="application\/json,.json"/)
    expect(html).toContain('A world as the server sends it.')
  })
})
