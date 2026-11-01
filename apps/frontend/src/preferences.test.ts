import { describe, expect, test } from 'vitest'

import {
  animates,
  DEFAULT_PREFERENCES,
  PreferenceStore,
  readPreferences,
  type KeyValueStorage,
} from './preferences'

/** `localStorage` as a plain map, to read what the store wrote. */
function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries))
  const storage: KeyValueStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
  return { storage, map }
}

/** Private browsing, site data disabled: every access throws. */
const blocked: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

describe('preferences | reading', () => {
  test('a browser that never chose has the defaults', () => {
    expect(readPreferences(memoryStorage().storage)).toEqual(DEFAULT_PREFERENCES)
    expect(DEFAULT_PREFERENCES).toMatchObject({
      theme: 'system',
      narrationVoice: true,
      autoRoll: false,
      animations: { dice: true, narration: true, hitPoints: true },
    })
  })

  test('no storage, or a blocked one, has the defaults too', () => {
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(readPreferences(blocked)).toEqual(DEFAULT_PREFERENCES)
  })

  test('reads the choices already made, under their keys of before', () => {
    const { storage } = memoryStorage({
      'wanderlore.theme': 'light',
      'wanderlore.narrationVoice': 'off',
      'wanderlore.autoRoll': 'on',
      'wanderlore.animations.dice': 'off',
    })

    expect(readPreferences(storage)).toEqual({
      theme: 'light',
      narrationVoice: false,
      autoRoll: true,
      animations: { dice: false, narration: true, hitPoints: true },
    })
  })

  test('a value it does not know is the default, without failing', () => {
    const { storage } = memoryStorage({
      'wanderlore.theme': 'sepia',
      'wanderlore.narrationVoice': 'true',
      'wanderlore.autoRoll': '',
      'wanderlore.animations.narration': '{"on":false}',
    })

    expect(readPreferences(storage)).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('preferences | the store', () => {
  test('writes each choice under its key', () => {
    const { storage, map } = memoryStorage()
    const store = new PreferenceStore(() => storage)

    store.setTheme('dark')
    store.setNarrationVoice(false)
    store.setAutoRoll(true)
    store.setAnimation('hitPoints', false)

    expect(Object.fromEntries(map)).toEqual({
      'wanderlore.theme': 'dark',
      'wanderlore.narrationVoice': 'off',
      'wanderlore.autoRoll': 'on',
      'wanderlore.animations.hitPoints': 'off',
    })
    expect(readPreferences(storage)).toEqual(store.get())
  })

  test('following the system again forgets the theme, as the first-paint script expects', () => {
    const { storage, map } = memoryStorage({ 'wanderlore.theme': 'light' })
    const store = new PreferenceStore(() => storage)

    store.setTheme('system')

    expect(map.has('wanderlore.theme')).toBe(false)
    expect(store.get().theme).toBe('system')
  })

  test('every reader hears of a change, wherever it was made', () => {
    const store = new PreferenceStore(() => memoryStorage().storage)
    const heard: string[] = []
    store.subscribe(() => heard.push('header'))
    const stop = store.subscribe(() => heard.push('preferences'))

    store.setNarrationVoice(false)
    stop()
    store.setNarrationVoice(true)

    expect(heard).toEqual(['header', 'preferences', 'header'])
  })

  test('hands out the same object until something changes', () => {
    const store = new PreferenceStore(() => memoryStorage().storage)
    const before = store.get()

    expect(store.get()).toBe(before)
    store.setAutoRoll(true)
    expect(store.get()).not.toBe(before)
    expect(before.autoRoll).toBe(false)
  })

  test('with storage blocked, a choice still lasts the visit', () => {
    const store = new PreferenceStore(() => blocked)

    store.setAnimation('dice', false)

    expect(store.get().animations.dice).toBe(false)
  })
})

describe('preferences | animations', () => {
  const allOff = {
    ...DEFAULT_PREFERENCES,
    animations: { dice: false, narration: false, hitPoints: false },
  }

  test('play as the player chose while the system says nothing', () => {
    expect(animates(DEFAULT_PREFERENCES, 'dice', false)).toBe(true)
    expect(animates(allOff, 'dice', false)).toBe(false)
  })

  test('the system asking for less motion is a floor no preference lifts', () => {
    expect(animates(DEFAULT_PREFERENCES, 'dice', true)).toBe(false)
    expect(animates(DEFAULT_PREFERENCES, 'narration', true)).toBe(false)
    expect(animates(DEFAULT_PREFERENCES, 'hitPoints', true)).toBe(false)
  })
})
