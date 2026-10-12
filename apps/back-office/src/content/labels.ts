/** Names by language code; English is always there — the fallback of every language. */
export type Labels = { en: string } & Record<string, string>

/** One name being edited: a language code and the name in it. */
export type LabelRow = { language: string; name: string }

/** English first, then the other languages in alphabetical order. */
export function rowsOf(labels: Labels): LabelRow[] {
  const others = Object.keys(labels)
    .filter((language) => language !== 'en')
    .sort()

  return [
    { language: 'en', name: labels.en },
    ...others.map((language) => ({ language, name: labels[language] ?? '' })),
  ]
}

/**
 * The names to send. Codes are trimmed and lower-cased; a row left without a
 * code or a name is dropped, except English, which the backend requires and
 * will name as missing.
 */
export function labelsOf(rows: LabelRow[]): Labels {
  const labels: Record<string, string> = { en: '' }

  for (const { language, name } of rows) {
    const code = language.trim().toLowerCase()
    const text = name.trim()

    if (code === 'en') labels.en = text
    else if (code !== '' && text !== '') labels[code] = text
  }

  return labels as Labels
}
