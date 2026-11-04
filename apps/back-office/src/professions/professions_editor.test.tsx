import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ProfessionsEditor } from './professions_editor'
import type { Profession } from './queries'

const MUSKETEER: Profession = {
  id: 'p1',
  worldId: 'w1',
  reference: 'musketeer',
  labels: { en: 'Musketeer' },
  description: 'A soldier of the King’s household.',
  skills: ['swordsmanship', 'ride'],
  startingItems: [],
  startingResources: {},
  updatedAt: null,
}

function render(professions: Profession[]) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ProfessionsEditor worldId="w1" professions={professions} skills={[]} />
    </QueryClientProvider>
  )
}

describe('ProfessionsEditor', () => {
  test('lists each profession by name and reference, with how many skills it trains', () => {
    const html = render([MUSKETEER])

    expect(html).toContain('Musketeer')
    expect(html).toContain('musketeer')
    expect(html).toContain('2 skills')
    expect(html).toContain('Add a profession')
  })

  test('says when the world has none: no character could be created in it', () => {
    expect(render([])).toContain('No profession yet')
  })
})
