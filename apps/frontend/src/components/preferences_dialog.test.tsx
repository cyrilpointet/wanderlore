import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { DEFAULT_PREFERENCES, type Preferences } from '@/preferences'
import { PreferencesPanel } from './preferences_dialog'

function render(
  preferences: Preferences = DEFAULT_PREFERENCES,
  { reducedBySystem = false, voiceSupported = true } = {}
) {
  return renderToStaticMarkup(
    <PreferencesPanel
      preferences={preferences}
      reducedBySystem={reducedBySystem}
      voiceSupported={voiceSupported}
    />
  )
}

/** The `switch` labelled by `label`, as its opening tag. */
function switchFor(markup: string, label: string): string {
  const labelId = markup.match(new RegExp(`id="([^"]+)"[^>]*>${label}<`))?.[1]
  const tag = markup.match(new RegExp(`<button[^>]*aria-labelledby="${labelId}"[^>]*>`))?.[0]
  if (!tag) throw new Error(`No switch for ${label}`)
  return tag
}

describe('Preferences', () => {
  test('shows every setting with its value', () => {
    const markup = render({
      theme: 'light',
      narrationVoice: false,
      autoRoll: true,
      animations: { dice: true, narration: false, hitPoints: true },
    })

    expect(markup).toMatch(/checked="" value="light"/)
    expect(markup.match(/checked=""/g)).toHaveLength(1)
    expect(switchFor(markup, 'Read the story aloud')).toContain('aria-checked="false"')
    expect(switchFor(markup, 'Roll the dice automatically')).toContain('aria-checked="true"')
    expect(switchFor(markup, 'Rolling dice')).toContain('aria-checked="true"')
    expect(switchFor(markup, 'Story fading in')).toContain('aria-checked="false"')
    expect(switchFor(markup, 'Hit point gauge')).toContain('aria-checked="true"')
  })

  test('says the choices stay in this browser', () => {
    expect(render()).toContain('Kept in this browser only.')
  })

  test('the system asking for less motion turns the animations off and locks them', () => {
    const markup = render(DEFAULT_PREFERENCES, { reducedBySystem: true })

    expect(markup).toContain('Your device asks for less motion')
    for (const label of ['Rolling dice', 'Story fading in', 'Hit point gauge']) {
      const tag = switchFor(markup, label)
      expect(tag).toContain('aria-checked="false"')
      expect(tag).toContain('disabled=""')
    }
    // Rolling the dice on their own is not an animation: the system has no say in it.
    expect(switchFor(markup, 'Roll the dice automatically')).not.toContain('disabled=""')
  })

  test('offers no reading aloud where the browser cannot speak', () => {
    const markup = render(DEFAULT_PREFERENCES, { voiceSupported: false })

    expect(markup).not.toContain('Read the story aloud')
    expect(markup).toContain('Roll the dice automatically')
  })
})
