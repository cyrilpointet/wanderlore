import { describe, expect, test } from 'vitest'

import { earliestTurnNumber, withEarlier, withTurn } from './journal_pages'
import type { JournalPages, Turn } from './queries'

function turn(turnNumber: number): Turn {
  return {
    id: `turn-${turnNumber}`,
    turnNumber,
    status: 'completed',
    playerInput: `Action ${turnNumber}`,
    roll: null,
    narration: `Narration ${turnNumber}`,
    effects: null,
    failure: null,
  }
}

function journal(numbers: number[], hasEarlier = true): JournalPages {
  return { turns: numbers.map(turn), hasEarlier }
}

const numbersOf = ({ turns }: JournalPages) => turns.map(({ turnNumber }) => turnNumber)

describe('withTurn', () => {
  test('adds a finished turn at the end of the story', () => {
    expect(numbersOf(withTurn(journal([21, 22]), turn(23)))).toEqual([21, 22, 23])
  })

  test('never adds the same turn twice', () => {
    const loaded = journal([21, 22])

    expect(withTurn(loaded, turn(22))).toBe(loaded)
  })

  test('keeps what remains to be loaded', () => {
    expect(withTurn(journal([21], true), turn(22)).hasEarlier).toBe(true)
  })
})

describe('withEarlier', () => {
  test('puts the page before the story loaded', () => {
    const merged = withEarlier(journal([21, 22]), journal([1, 2, 20], false))

    expect(numbersOf(merged)).toEqual([1, 2, 20, 21, 22])
    expect(merged.hasEarlier).toBe(false)
  })

  test('never shows a turn twice', () => {
    expect(numbersOf(withEarlier(journal([21, 22]), journal([20, 21])))).toEqual([20, 21, 22])
  })
})

describe('earliestTurnNumber', () => {
  test('is where the next earlier page ends', () => {
    expect(earliestTurnNumber(journal([21, 22]))).toBe(21)
  })

  test('is nothing when nothing is loaded', () => {
    expect(earliestTurnNumber(journal([]))).toBeUndefined()
  })
})
