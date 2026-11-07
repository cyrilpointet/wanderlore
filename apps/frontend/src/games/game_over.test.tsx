import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { EndReason } from '@/api/enums'
import { withRouter } from '@/test/router'
import { EndStamp, GameOver } from './game_over'

function render(endReason: EndReason | null) {
  return renderToStaticMarkup(
    withRouter(<GameOver characterId="character-1" name="d'Artagnan" endReason={endReason} />)
  )
}

describe('GameOver', () => {
  test.each([
    ['victory', 'Victory', 'd&#x27;Artagnan saw the story through.', 'text-success'],
    ['defeat', 'Defeat', 'The story ends in defeat for d&#x27;Artagnan.', 'text-danger'],
    ['death', 'Death', 'd&#x27;Artagnan is dead. The story ends here.', 'text-danger'],
    ['abandoned', 'Abandoned', 'You abandoned this story.', 'text-danger'],
  ] as const)('a game ended by %s is stamped with its reason', (reason, stamp, message, tone) => {
    const html = render(reason)

    expect(html).toContain('role="status"')
    expect(html).toContain(`>${stamp}</span>`)
    expect(html).toContain(tone)
    expect(html).toContain(message)
    expect(html).toContain('href="/characters/character-1"')
    expect(html).toContain('Back to d&#x27;Artagnan')
  })

  test('a game closed without a reason only says it is over', () => {
    const html = render(null)

    expect(html).toContain('This game is over.')
    expect(html).not.toContain('border-current')
    expect(html).toContain('Back to d&#x27;Artagnan')
  })
})

describe('EndStamp', () => {
  test('is pressed onto the sheet only when asked', () => {
    expect(renderToStaticMarkup(<EndStamp reason="victory" pressed />)).toContain(
      'animate-stamp-press'
    )
    expect(renderToStaticMarkup(<EndStamp reason="victory" />)).not.toContain('animate-stamp-press')
  })
})
