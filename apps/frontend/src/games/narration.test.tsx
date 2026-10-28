import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { Narration } from './journal'
import { TurnInFlight } from './turn_in_flight'

describe('Narration | fading in', () => {
  test('fades in when asked, and only then', () => {
    expect(renderToStaticMarkup(<Narration text="The door creaks." fadeIn />)).toContain(
      'animate-fade-in'
    )
    expect(renderToStaticMarkup(<Narration text="The door creaks." />)).not.toContain(
      'animate-fade-in'
    )
  })

  test('the narration being written fades in, as the preferences have it by default', () => {
    const markup = renderToStaticMarkup(
      <TurnInFlight
        state={{
          status: 'in_progress',
          submission: { playerInput: 'I open the door.', idempotencyKey: 'key', turnId: 'turn' },
          step: 'narration',
          roll: null,
          narration: 'The door creaks.',
        }}
        onRetry={() => {}}
        onEdit={() => {}}
      />
    )

    expect(markup).toContain('The door creaks.')
    expect(markup).toContain('animate-fade-in')
  })
})
