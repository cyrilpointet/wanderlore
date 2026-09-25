import { describe, expect, test } from 'vitest'

import { relativeTime } from './relative_time'

const NOW = new Date('2026-09-25T12:00:00Z')
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

describe('relativeTime', () => {
  test.each([
    [30, 0, 'second'],
    [60, -1, 'minute'],
    [59 * 60, -59, 'minute'],
    [2 * 3600 + 1800, -2, 'hour'],
    [3 * 24 * 3600, -3, 'day'],
    [8 * 24 * 3600, -1, 'week'],
    [45 * 24 * 3600, -1, 'month'],
    [400 * 24 * 3600, -1, 'year'],
  ])('%is ago reads as %i %s', (seconds, value, unit) => {
    expect(relativeTime(ago(seconds), NOW)).toEqual({ value, unit })
  })

  test('reads a date slightly in the future as now', () => {
    expect(relativeTime(ago(-5), NOW)).toEqual({ value: 0, unit: 'second' })
  })
})
