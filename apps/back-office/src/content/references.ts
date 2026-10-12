/** A stable English reference, as the backend accepts it. */
export const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

export function isReference(value: string): boolean {
  return REFERENCE.test(value)
}

/**
 * A reference proposed from an English name — "Cardinal's Guard" gives
 * `cardinals_guard` — for the game master to keep or change before saving.
 * Once saved, a reference never changes.
 */
export function suggestReference(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)

  return /^[a-z]/.test(slug) ? slug : slug === '' ? '' : `x_${slug}`.slice(0, 64)
}
