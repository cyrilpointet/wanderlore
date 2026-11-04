import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { withRouter } from '@/test/router'
import { GameOver } from './game_over'

describe('GameOver', () => {
  test('says the game is over and leads back to the character', () => {
    const html = renderToStaticMarkup(
      withRouter(<GameOver characterId="character-1" name="d'Artagnan" />)
    )

    expect(html).toContain('This game is over.')
    expect(html).toContain('href="/characters/character-1"')
    expect(html).toContain('Back to d&#x27;Artagnan')
  })
})
