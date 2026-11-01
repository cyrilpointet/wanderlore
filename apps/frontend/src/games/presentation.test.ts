import { describe, expect, test } from 'vitest'

import {
  gaugePercent,
  groupSkills,
  paragraphs,
  percentileDice,
  showsQuantity,
} from './presentation'

describe('groupSkills', () => {
  test('puts each skill under its BRP category, in the order of the categories', () => {
    const groups = groupSkills({
      skills: [
        { reference: 'athletics', label: 'Athletics', value: 30, category: 'physical' },
        { reference: 'swordsmanship', label: 'Swordsmanship', value: 60, category: 'combat' },
        { reference: 'persuasion', label: 'Persuasion', value: 45, category: 'communication' },
        { reference: 'stealth', label: 'Stealth', value: 25, category: 'physical' },
      ],
    })

    /** Categories without a skill of theirs are left out. */
    expect(groups.map((group) => [group.category, group.skills.map((s) => s.reference)])).toEqual([
      ['combat', ['swordsmanship']],
      ['communication', ['persuasion']],
      ['physical', ['athletics', 'stealth']],
    ])
  })
})

describe('paragraphs', () => {
  test('splits on line breaks, single or doubled, and drops blank lines', () => {
    expect(paragraphs('The inn is quiet.\n\n  A door creaks.\nSomeone laughs.\n\n\n')).toEqual([
      'The inn is quiet.',
      'A door creaks.',
      'Someone laughs.',
    ])
  })

  test('keeps markup as plain text', () => {
    expect(paragraphs('<b>bold</b> **not bold**')).toEqual(['<b>bold</b> **not bold**'])
  })
})

describe('gaugePercent', () => {
  test.each([
    [8, 10, 80],
    [0, 10, 0],
    [12, 10, 100],
    [-2, 10, 0],
    [3, 0, 0],
  ])('%i / %i fills %i%%', (current, max, percent) => {
    expect(gaugePercent(current, max)).toBe(percent)
  })
})

describe('showsQuantity', () => {
  test('a stack shows how many, even one; a copy shows none', () => {
    expect(showsQuantity({ handle: null, quantity: 1 })).toBe(true)
    expect(showsQuantity({ handle: null, quantity: 6 })).toBe(true)
    expect(showsQuantity({ handle: 'rapier_1', quantity: 1 })).toBe(false)
  })
})

describe('percentileDice', () => {
  test('splits the d100 into the tens die and the units die', () => {
    expect(percentileDice(45)).toEqual({ tens: 4, units: 5 })
    expect(percentileDice(10)).toEqual({ tens: 1, units: 0 })
    expect(percentileDice(1)).toEqual({ tens: 0, units: 1 })
    expect(percentileDice(99)).toEqual({ tens: 9, units: 9 })
  })

  test('reads a hundred as 00 and 0, as on the table', () => {
    expect(percentileDice(100)).toEqual({ tens: 0, units: 0 })
  })
})
