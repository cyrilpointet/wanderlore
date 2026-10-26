import { test } from '@japa/runner'

import {
  DAY,
  MAX_DAYS,
  type Duration,
  type Period,
  dateOf,
  dayOf,
  periodAt,
  quarterHourOf,
  secondsOf,
  secondsOfTime,
  secondsUntil,
  weekdayOf,
} from '#services/game/game_time'

/** A clock reading on a day of the game, from `HH:MM`: day 1 is the first. */
function at(time: string, day = 1): number {
  return (day - 1) * DAY + secondsOfTime(time)
}

test.group('Game time | durations', () => {
  test('each label is worth its span of time', ({ assert }) => {
    const spans: [Duration, number][] = [
      [{ label: 'moment' }, 60],
      [{ label: 'minutes' }, 600],
      [{ label: 'hour' }, 3600],
      [{ label: 'hours' }, 4 * 3600],
      [{ label: 'days', count: 1 }, DAY],
      [{ label: 'days', count: MAX_DAYS }, 7 * DAY],
    ]

    for (const [duration, seconds] of spans) {
      assert.equal(secondsOf(duration, at('10:00')), seconds, duration.label)
    }
  })

  test('a week is the longest a turn may last', ({ assert }) => {
    assert.equal(MAX_DAYS, 7)
  })

  test('until lasts to the start of the period', ({ assert }) => {
    assert.equal(secondsOf({ label: 'until', period: 'night' }, at('16:00')), 6 * 3600)
    assert.equal(secondsUntil('dusk', at('17:30')), 30 * 60)
  })

  test('until the period already under way waits for its next occurrence', ({ assert }) => {
    /** At 23:00 it is night: the next night begins at 22:00 the day after. */
    assert.equal(secondsUntil('night', at('23:00')), 23 * 3600)
    assert.equal(secondsUntil('morning', at('09:00')), 22 * 3600)
  })

  test('until dawn from the evening crosses midnight', ({ assert }) => {
    assert.equal(secondsUntil('dawn', at('21:00')), 8 * 3600)
  })

  test('until a period from the day before', ({ assert }) => {
    /** At 3 in the morning the night began yesterday; the next one begins tonight. */
    assert.equal(secondsUntil('night', at('03:00')), 19 * 3600)
  })

  test('until is always strictly in the future, even on the bound itself', ({ assert }) => {
    assert.equal(secondsUntil('dawn', at('05:00')), DAY)
    assert.equal(secondsUntil('dawn', at('04:59')), 60)
  })
})

test.group('Game time | periods', () => {
  /** Each bound from both sides: the last minute of a period and the first of the next. */
  const bounds: [string, Period][] = [
    ['00:00', 'night'],
    ['04:59', 'night'],
    ['05:00', 'dawn'],
    ['06:59', 'dawn'],
    ['07:00', 'morning'],
    ['11:59', 'morning'],
    ['12:00', 'midday'],
    ['13:59', 'midday'],
    ['14:00', 'afternoon'],
    ['17:59', 'afternoon'],
    ['18:00', 'dusk'],
    ['19:59', 'dusk'],
    ['20:00', 'evening'],
    ['21:59', 'evening'],
    ['22:00', 'night'],
    ['23:59', 'night'],
  ]

  for (const [time, period] of bounds) {
    test(`${period} at ${time}`, ({ assert }) => {
      assert.equal(periodAt(at(time)), period)
      assert.equal(periodAt(at(time, 4)), period, 'the same on any day')
    })
  }
})

test.group('Game time | days and dates', () => {
  test('the first day is day 1, and a day turns at midnight', ({ assert }) => {
    assert.equal(dayOf(at('08:00')), 1)
    assert.equal(dayOf(at('23:59')), 1)
    assert.equal(dayOf(at('00:00', 2)), 2)
  })

  test('no date without a date to start from', ({ assert }) => {
    assert.isNull(dateOf(at('10:00', 3), null))
    assert.isNull(weekdayOf(at('10:00', 3), null))
  })

  test('the date moves on with the days', ({ assert }) => {
    assert.equal(dateOf(at('16:00'), '1927-10-28'), '1927-10-28')
    assert.equal(dateOf(at('01:00', 2), '1927-10-28'), '1927-10-29')
  })

  test('across the end of a month and of a year', ({ assert }) => {
    assert.equal(dateOf(at('10:00', 5), '1927-10-28'), '1927-11-01')
    assert.equal(dateOf(at('10:00', 2), '1926-12-31'), '1927-01-01')
  })

  test('across a leap day', ({ assert }) => {
    assert.equal(dateOf(at('10:00', 2), '1928-02-28'), '1928-02-29')
    assert.equal(dateOf(at('10:00', 2), '1927-02-28'), '1927-03-01')
  })

  test('in 1625, in the Gregorian calendar France already used', ({ assert }) => {
    assert.equal(dateOf(at('10:00'), '1625-04-07'), '1625-04-07')
    assert.equal(dateOf(at('10:00', 30), '1625-04-07'), '1625-05-06')
    /** Dumas: "le premier lundi du mois d'avril 1625". */
    assert.equal(weekdayOf(at('10:00'), '1625-04-07'), 'monday')
  })

  test('the day of the week follows the date', ({ assert }) => {
    assert.equal(weekdayOf(at('16:00'), '1927-10-28'), 'friday')
    assert.equal(weekdayOf(at('16:00', 3), '1927-10-28'), 'sunday')
  })
})

test.group('Game time | time of day', () => {
  test('rounded to the nearest quarter of an hour', ({ assert }) => {
    assert.equal(quarterHourOf(at('16:00')), '16:00')
    assert.equal(quarterHourOf(at('16:07')), '16:00')
    assert.equal(quarterHourOf(at('16:08')), '16:15')
    assert.equal(quarterHourOf(at('16:52')), '16:45')
    assert.equal(quarterHourOf(at('16:53')), '17:00')
  })

  test('rounded past midnight, to the next day', ({ assert }) => {
    assert.equal(quarterHourOf(at('23:55')), '00:00')
  })

  test('a scenario writes its starting time as HH:MM', ({ assert }) => {
    assert.equal(secondsOfTime('00:00'), 0)
    assert.equal(secondsOfTime('16:30'), 16 * 3600 + 30 * 60)
    assert.throws(() => secondsOfTime('24:00'))
    assert.throws(() => secondsOfTime('8:00'))
  })
})
