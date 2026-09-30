/** Only what the choice reads of a `SpeechSynthesisVoice`, so it can be tested without a browser. */
export type VoiceCandidate = Pick<SpeechSynthesisVoice, 'name' | 'lang'>

/**
 * macOS novelty and robotic voices: the browser happily picks one of them by
 * default, since "Albert" comes first in alphabetical order.
 */
const NOVELTY = new Set(
  [
    'Albert',
    'Bad News',
    'Bahh',
    'Bells',
    'Boing',
    'Bubbles',
    'Cellos',
    'Deranged',
    'Eddy',
    'Flo',
    'Fred',
    'Good News',
    'Grandma',
    'Grandpa',
    'Hysterical',
    'Jester',
    'Junior',
    'Kathy',
    'Organ',
    'Pipe Organ',
    'Princess',
    'Ralph',
    'Reed',
    'Rocko',
    'Sandy',
    'Shelley',
    'Superstar',
    'Trinoids',
    'Whisper',
    'Wobble',
    'Zarvox',
  ].map((name) => name.toLowerCase())
)

/** Voices known to read a story well, best first, by a fragment of their name. */
const PREFERRED = [
  /\(premium\)/i,
  /\(enhanced\)/i,
  /natural/i, // Edge's neural voices
  /^google/i,
  /^(samantha|daniel|karen|moira|serena|thomas|amélie|anna|paulina)\b/i,
]

/**
 * The voice that reads the narration: one speaking the language, never a
 * novelty one, the best-sounding available. `null` leaves the choice to the
 * browser — when no voice speaks the language at all.
 */
export function chooseVoice<T extends VoiceCandidate>(voices: T[], language: string): T | null {
  const base = baseLanguage(language)
  const speaking = voices.filter(
    (voice) =>
      baseLanguage(voice.lang) === base &&
      !NOVELTY.has(voice.name.replace(/\s*\(.*$/, '').toLowerCase())
  )

  const rank = (voice: T) => {
    const index = PREFERRED.findIndex((pattern) => pattern.test(voice.name))
    return index === -1 ? PREFERRED.length : index
  }

  // Stable: among equals, the browser's own order stands.
  return [...speaking].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

/** `en-US`, `en_GB` and `en` all speak `en`. */
function baseLanguage(tag: string): string {
  return tag.toLowerCase().split(/[-_]/, 1).join('')
}
