import { preferences } from './preferences'

/**
 * Light by default, dark available — "the table at night" — and the system's
 * preference followed when the player chooses so (front spec, section 7). The
 * choice is a preference like the others (`preferences.ts`).
 *
 * The first paint is handled by the inline script of `index.html`, which must
 * stay in step with `resolveTheme()` and the theme's storage key.
 */
export type Theme = 'dark' | 'light'
export type ThemeChoice = Theme | 'system'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

export function resolveTheme(choice: ThemeChoice, systemPrefersLight: boolean): Theme {
  if (choice !== 'system') return choice
  return systemPrefersLight ? 'light' : 'dark'
}

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(
    preferences.get().theme,
    matchMedia(LIGHT_QUERY).matches
  )
}

/** Applies the theme whenever the player chooses another, or the system switches. */
export function watchTheme() {
  preferences.subscribe(applyTheme)
  matchMedia(LIGHT_QUERY).addEventListener('change', applyTheme)
}
