import { describe, expect, test } from 'vitest'

import { chooseVoice, type VoiceCandidate } from './voice_choice'

const voice = (name: string, lang: string): VoiceCandidate => ({ name, lang })

describe('chooseVoice', () => {
  test('never picks a novelty voice, even when it comes first', () => {
    const voices = [voice('Albert', 'en-US'), voice('Zarvox', 'en-US'), voice('Samantha', 'en-US')]

    expect(chooseVoice(voices, 'en')?.name).toBe('Samantha')
  })

  test('prefers a premium voice, then an enhanced one', () => {
    const voices = [
      voice('Samantha', 'en-US'),
      voice('Daniel (Enhanced)', 'en-GB'),
      voice('Ava (Premium)', 'en-US'),
    ]

    expect(chooseVoice(voices, 'en')?.name).toBe('Ava (Premium)')
  })

  test('only picks a voice speaking the language', () => {
    const voices = [voice('Thomas', 'fr-FR'), voice('Samantha', 'en-US')]

    expect(chooseVoice(voices, 'fr')?.name).toBe('Thomas')
    expect(chooseVoice(voices, 'de')).toBeNull()
  })

  test('keeps the browser order among equals', () => {
    const voices = [voice('Aaron', 'en-US'), voice('Nicky', 'en-US')]

    expect(chooseVoice(voices, 'en-US')?.name).toBe('Aaron')
  })
})
