import { useSyncExternalStore } from 'react'

import type { ThemeChoice } from './theme'

/**
 * The player's interface preferences: choices of display that change nothing
 * in the game. Kept in this browser and nowhere else — never in the database,
 * never sent to the backend, which needs none of them to play a turn (front
 * spec, sections 5.5 and 7). They belong to the device rather than to the
 * account, and outlive signing out.
 */

/** The animations a player can turn off, one by one. */
export const ANIMATIONS = ['dice', 'narration', 'hitPoints'] as const
export type Animation = (typeof ANIMATIONS)[number]

export type Preferences = {
  theme: ThemeChoice
  /** Reading the narration aloud, where the browser can speak. */
  narrationVoice: boolean
  /** The dice of a live roll are thrown without waiting for the player. */
  autoRoll: boolean
  animations: Record<Animation, boolean>
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  narrationVoice: true,
  autoRoll: false,
  animations: { dice: true, narration: true, hitPoints: true },
}

/** What the store needs of `localStorage`, so it can be tested without a browser. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * One key per setting. The theme is read before the first paint by the
 * inline script of `index.html`, and the voice predates this module: both
 * keep their key and values, so no player loses a choice already made.
 */
const THEME_KEY = 'wanderlore.theme'
const VOICE_KEY = 'wanderlore.narrationVoice'
const AUTO_ROLL_KEY = 'wanderlore.autoRoll'
const animationKey = (animation: Animation) => `wanderlore.animations.${animation}`

/**
 * The preferences as stored. Anything missing, unknown or unreadable is the
 * default: a stored value never makes the front fail.
 */
export function readPreferences(storage: KeyValueStorage | null): Preferences {
  const read = (key: string) => {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  const theme = read(THEME_KEY)
  return {
    theme: theme === 'dark' || theme === 'light' ? theme : DEFAULT_PREFERENCES.theme,
    narrationVoice: flag(read(VOICE_KEY), DEFAULT_PREFERENCES.narrationVoice),
    autoRoll: flag(read(AUTO_ROLL_KEY), DEFAULT_PREFERENCES.autoRoll),
    animations: Object.fromEntries(
      ANIMATIONS.map((animation) => [
        animation,
        flag(read(animationKey(animation)), DEFAULT_PREFERENCES.animations[animation]),
      ])
    ) as Record<Animation, boolean>,
  }
}

function flag(stored: string | null, fallback: boolean): boolean {
  if (stored === 'on') return true
  if (stored === 'off') return false
  return fallback
}

const onOff = (value: boolean) => (value ? 'on' : 'off')

/**
 * The single source of the preferences: the preferences screen and the
 * game header read and change the same values, and each reader hears of a
 * change made by another. Kept in memory as well as in storage, so a choice
 * still lasts the visit when storage is blocked.
 */
export class PreferenceStore {
  #current: Preferences | null = null
  #listeners = new Set<() => void>()

  /** Looked up at each use: reaching `localStorage` can itself throw. */
  constructor(private readonly storage: () => KeyValueStorage | null) {}

  get = (): Preferences => (this.#current ??= readPreferences(this.storage()))

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => void this.#listeners.delete(listener)
  }

  setTheme(theme: ThemeChoice) {
    // `system` is the absence of a choice, as the script of `index.html` expects.
    if (theme === 'system') this.#remove(THEME_KEY)
    else this.#write(THEME_KEY, theme)
    this.#update({ ...this.get(), theme })
  }

  setNarrationVoice(on: boolean) {
    this.#write(VOICE_KEY, onOff(on))
    this.#update({ ...this.get(), narrationVoice: on })
  }

  setAutoRoll(on: boolean) {
    this.#write(AUTO_ROLL_KEY, onOff(on))
    this.#update({ ...this.get(), autoRoll: on })
  }

  setAnimation(animation: Animation, on: boolean) {
    this.#write(animationKey(animation), onOff(on))
    const current = this.get()
    this.#update({ ...current, animations: { ...current.animations, [animation]: on } })
  }

  #update(next: Preferences) {
    this.#current = next
    for (const listener of this.#listeners) listener()
  }

  #write(key: string, value: string) {
    try {
      this.storage()?.setItem(key, value)
    } catch {
      // Blocked storage: the choice then lasts as long as the visit.
    }
  }

  #remove(key: string) {
    try {
      this.storage()?.removeItem(key)
    } catch {
      // Same as above.
    }
  }
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Site data disabled: even reaching the storage throws.
    return null
  }
}

export const preferences = new PreferenceStore(browserStorage)

/** The preferences, the component rendered again whenever one changes. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(preferences.subscribe, preferences.get, preferences.get)
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** Whether the system asks for less motion. Never true where there is no system to ask. */
export function systemReducesMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia(REDUCED_MOTION).matches
}

function onReducedMotionChange(listener: () => void) {
  const query = matchMedia(REDUCED_MOTION)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** Followed while the screen is open: the system's setting can change meanwhile. */
export function useSystemReducesMotion(): boolean {
  return useSyncExternalStore(onReducedMotionChange, systemReducesMotion, () => false)
}

/**
 * Whether an animation plays. The system is a floor: when it asks for less
 * motion, no preference brings an animation back.
 */
export function animates(
  current: Preferences,
  animation: Animation,
  reducedBySystem: boolean
): boolean {
  return !reducedBySystem && current.animations[animation]
}

export function useAnimates(animation: Animation): boolean {
  return animates(usePreferences(), animation, useSystemReducesMotion())
}
