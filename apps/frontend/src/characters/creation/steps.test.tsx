import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { CreationWorld, PreviewSheet } from '../queries'
import { DiceStep } from './dice_step'
import { IdentityStep } from './identity_step'
import { PlacementStep } from './placement_step'
import { ProfessionStep } from './profession_step'
import { SkillsStep } from './skills_step'

const ROLL = {
  id: 'roll-1',
  values: [14, 9, 6, 12, 17, 10, 5],
  dice: [
    [6, 5, 3],
    [1, 4, 4],
    [2, 2, 2],
    [6, 3, 3],
    [6, 6, 5],
    [5, 4, 1],
    [1, 1, 3],
  ],
}

const CREATION: CreationWorld = {
  world: {
    id: 'world-1',
    reference: 'three_musketeers',
    label: 'The Three Musketeers',
    tone: 'Cloak and dagger.',
  },
  powerLevel: 'heroic',
  professionalPoints: 300,
  skillCap: 75,
  personalPointsPerInt: 10,
  characteristicFloor: 8,
  nameMaxLength: 35,
  professions: [
    {
      reference: 'musketeer',
      label: 'Musketeer',
      description: 'A soldier of the King’s guard.',
      skills: [
        { reference: 'fencing', label: 'Fencing' },
        { reference: 'ride', label: 'Ride' },
      ],
      startingItems: [
        { item: { reference: 'rapier', label: 'Rapier' }, quantity: 1, equipped: true },
        { item: { reference: 'pistol_shot', label: 'Pistol shot' }, quantity: 6, equipped: false },
      ],
      startingResources: [{ reference: 'purse', label: 'Purse', value: 15 }],
    },
  ],
  skills: [
    { reference: 'fencing', label: 'Fencing', category: 'combat', baseChance: 15 },
    { reference: 'ride', label: 'Ride', category: 'physical', baseChance: 5 },
    {
      reference: 'dodge',
      label: 'Dodge',
      category: 'physical',
      baseChance: { characteristic: 'DEX', multiplier: 2 },
    },
  ],
}

const SHEET: PreviewSheet = {
  characteristics: { STR: 14, CON: 9, SIZ: 8, INT: 12, POW: 17, DEX: 10, CHA: null },
  raised: ['SIZ'],
  profession: 'musketeer',
  skills: [
    { reference: 'fencing', base: 15, professional: 50, personal: 0, value: 65 },
    { reference: 'ride', base: 5, professional: 0, personal: 0, value: 5 },
    { reference: 'dodge', base: null, professional: 0, personal: 10, value: null },
  ],
  professionalPool: { total: 300, spent: 50, left: 250 },
  personalPool: { total: 120, spent: 10, left: 110 },
  skillCap: 75,
  hitPoints: 17,
}

/** The visible text, tags dropped. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('DiceStep', () => {
  const render = (roll: typeof ROLL | null, animated: boolean, rolling = false) =>
    renderToStaticMarkup(
      <DiceStep roll={roll} rolling={rolling} error={null} animated={animated} onRoll={() => {}} />
    )

  test('before the first roll: blank dice and a way to roll', () => {
    const html = render(null, true)

    expect(html).toContain('Roll the dice')
    expect(html).not.toContain('animate-dice-spin')
  })

  test('animated: each of the 21 d6 runs past its faces and stops on its own, one after the other', () => {
    const html = render(ROLL, true)

    expect(html.match(/animate-dice-spin/g)).toHaveLength(21)
    // The first die stops on its 6: two turns of six faces, then the sixth.
    expect(html).toContain('transform:translateY(-38.25rem);animation-duration:600ms')
    // The last one, the 3 of the seventh result, settles last.
    expect(html).toContain('transform:translateY(-31.5rem);animation-duration:2400ms')
    expect(textOf(html)).toContain('14')
    expect(html).toContain('Reroll')
    expect(html).toContain('clears their placement')
  })

  test('still: the results stand as they are, and are read out at once', () => {
    const html = render(ROLL, false)

    expect(html).not.toContain('animate-dice-spin')
    // Each result shows its three faces as drawn, then its total.
    const faces = [...html.matchAll(/data-face="(\d)"/g)].map(([, face]) => Number(face))
    expect(faces).toEqual(ROLL.dice.flat())
    expect(textOf(html)).toContain('14 9 6 12 17 10 5')
    // The list is joined in the interface language: only the order is checked.
    expect(textOf(html)).toMatch(/Results: 14, 9, 6, 12, 17, 10,? \S+ 5/)
  })

  test('says a roll is on its way', () => {
    const html = render(ROLL, false, true)

    expect(html).toContain('Rolling…')
    expect(html).toContain('disabled')
  })
})

describe('PlacementStep', () => {
  const render = (issues: { code: string; field: string }[] = []) =>
    renderToStaticMarkup(
      <PlacementStep
        roll={ROLL}
        placement={{ STR: 0, CON: 1, SIZ: 6, INT: 3, POW: 4, DEX: 5 }}
        floor={8}
        sheet={SHEET}
        issues={issues}
        onPlace={() => {}}
        onUnplace={() => {}}
      />
    )

  test('every characteristic with its result, the score from the preview', () => {
    const text = textOf(render())

    expect(text).toContain('Strength')
    expect(text).toContain('Strength score: 14')
    expect(text).toContain('Charisma score: —')
    expect(text).toContain('Hit points: 17')
  })

  test('says SIZ and INT have a floor, and which one the backend raised', () => {
    const text = textOf(render())

    expect(text).toContain('Size and Intelligence never go below 8')
    expect(text).toContain('Raised to 8')
  })

  test('a result already placed says where it is', () => {
    expect(render()).toContain('14 (now Strength)')
  })

  test('shows a placement the backend refuses', () => {
    expect(textOf(render([{ code: 'invalid_placement', field: 'placement.STR' }]))).toContain(
      'Each result goes to one characteristic, once.'
    )
  })
})

describe('ProfessionStep', () => {
  test('each profession with its description, its skills and what it starts with', () => {
    const text = textOf(
      renderToStaticMarkup(
        <ProfessionStep
          professions={CREATION.professions}
          chosen="musketeer"
          issues={[]}
          onChoose={() => {}}
        />
      )
    )

    expect(text).toContain('Musketeer')
    expect(text).toContain('A soldier of the King’s guard.')
    // Lists are joined in the interface language: only their items and order are checked.
    expect(text).toMatch(/Skills: Fencing \S+ Ride/)
    expect(text).toMatch(/Starts with: Rapier \(equipped\), Pistol shot ×6,? \S+ Purse 15/)
  })

  test('shows a refusal of the profession', () => {
    const text = textOf(
      renderToStaticMarkup(
        <ProfessionStep
          professions={CREATION.professions}
          chosen={null}
          issues={[{ code: 'unknown_profession', field: 'profession' }]}
          onChoose={() => {}}
        />
      )
    )

    expect(text).toContain('This profession does not exist in this world.')
  })
})

describe('SkillsStep', () => {
  const render = (sheet: PreviewSheet, issues: { code: string; field: string }[] = []) =>
    textOf(
      renderToStaticMarkup(
        <SkillsStep
          creation={CREATION}
          profession="musketeer"
          professionalPoints={{ fencing: 50 }}
          personalPoints={{ dodge: 10 }}
          sheet={sheet}
          issues={issues}
          onPoints={() => {}}
        />
      )
    )

  test('both pools with what is left, the cap, each skill with its base and value', () => {
    const text = render(SHEET)

    expect(text).toContain('250 left of 300')
    expect(text).toContain('110 left of 120')
    expect(text).toContain('No skill may go above 75% at creation.')
    expect(text).toContain('Skills of the profession')
    expect(text).toContain('Base 15%')
    expect(text).toContain('Fencing: 65%')
    expect(text).toContain('Base Dexterity ×2')
  })

  test('points left over are pointed out, without standing in the way', () => {
    expect(render(SHEET)).toContain('250 points unspent: you can still go on.')

    const spent = {
      ...SHEET,
      professionalPool: { total: 300, spent: 300, left: 0 },
      personalPool: { total: 120, spent: 120, left: 0 },
    }
    expect(render(spent)).not.toContain('unspent')
  })

  test('shows what the backend refuses, on the pool and on the skill', () => {
    const text = render(SHEET, [
      { code: 'pool_exceeded', field: 'personalPoints' },
      { code: 'skill_cap_exceeded', field: 'skills.fencing' },
    ])

    expect(text).toContain('More points are spent than the pool holds.')
    expect(text).toContain('This skill goes over the cap.')
  })
})

describe('IdentityStep', () => {
  const render = (name: string, issues: { code: string; field: string }[] = []) =>
    textOf(
      renderToStaticMarkup(
        <IdentityStep
          creation={CREATION}
          name={name}
          gender="female"
          profession="musketeer"
          sheet={SHEET}
          issues={issues}
          onName={() => {}}
          onGender={() => {}}
        />
      )
    )

  test('the name with its counter, the three genders, and the sheet to come', () => {
    const text = render('Anne')

    expect(text).toContain('4 / 35')
    for (const gender of ['Female', 'Male', 'Neutral']) expect(text).toContain(gender)
    expect(text).toContain('Musketeer · Female · The Three Musketeers')
    expect(text).toContain('Fencing 65%')
    expect(text).not.toContain('Ride')
  })

  test('a name the backend refuses says so; an empty one is only not done yet', () => {
    const issue = [{ code: 'invalid_character_name', field: 'name' }]

    expect(render('Anne 2', issue)).toContain('A name is made of letters')
    expect(render('', issue)).not.toContain('A name is made of letters')
  })
})
