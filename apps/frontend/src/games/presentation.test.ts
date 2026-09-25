import { describe, expect, test } from 'vitest'

import { gaugePercent, groupSkills, paragraphs } from './presentation'

describe('groupSkills', () => {
  test('puts each skill under its attribute, keeping the order received', () => {
    const groups = groupSkills({
      attributes: [
        { reference: 'physical', label: 'Physical', value: 3 },
        { reference: 'mental', label: 'Mental', value: 2 },
        { reference: 'social', label: 'Social', value: 3 },
      ],
      skills: [
        { reference: 'swordsmanship', label: 'Swordsmanship', value: 3, attribute: 'physical' },
        { reference: 'persuasion', label: 'Persuasion', value: 2, attribute: 'social' },
        { reference: 'athletics', label: 'Athletics', value: 1, attribute: 'physical' },
      ],
    })

    expect(groups.map((group) => [group.reference, group.skills.map((s) => s.reference)])).toEqual([
      ['physical', ['swordsmanship', 'athletics']],
      ['mental', []],
      ['social', ['persuasion']],
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
