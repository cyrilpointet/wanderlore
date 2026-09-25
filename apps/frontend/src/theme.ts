/**
 * Dark by default, light available, and the system's preference followed as
 * long as the player has not chosen (front spec, section 7).
 *
 * The first paint is handled by the inline script of `index.html`, which must
 * stay in step with `resolveTheme()` and the storage key below.
 */
export type Theme = 'dark' | 'light'
export type ThemeChoice = Theme | 'system'

const STORAGE_KEY = 'wanderlore.theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

export function resolveTheme(choice: ThemeChoice, systemPrefersLight: boolean): Theme {
  if (choice !== 'system') return choice
  return systemPrefersLight ? 'light' : 'dark'
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'dark' || stored === 'light' ? stored : 'system'
  } catch {
    // Storage can be blocked (private mode, site data disabled): follow the system.
    return 'system'
  }
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // The choice then lasts for this visit only.
  }
  applyTheme(choice)
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolveTheme(choice, matchMedia(LIGHT_QUERY).matches)
}

/** Keeps following the system when it switches theme while the app is open. */
export function watchSystemTheme() {
  matchMedia(LIGHT_QUERY).addEventListener('change', () => {
    const choice = readThemeChoice()
    if (choice === 'system') applyTheme(choice)
  })
}
