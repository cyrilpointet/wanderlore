import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { Roll } from './queries'
import { RollCard } from './roll_card'
import type { LiveRoll } from './roll_reveal'

/** Persuasion at 60%, made difficult and helped by a letter: 40%, and a 45 on the d100. */
const ROLL: Roll = {
  skill: { reference: 'persuasion', label: 'Persuasion' },
  characteristic: null,
  value: 60,
  baseChance: 60,
  difficulty: 'difficult',
  modifiers: [
    { source: 'item', item: { reference: 'letter', label: 'Letter of introduction' }, value: 10 },
  ],
  chance: 40,
  roll: 45,
  result: 'failure',
  degree: 'failure',
  combat: null,
}

/** A sword thrust at 60%, a 12: a hit, an impaling one, for 6 + 2 − 1 armor. */
const ATTACK: Roll = {
  skill: { reference: 'swordsmanship', label: 'Swordsmanship' },
  characteristic: null,
  value: 60,
  baseChance: 60,
  difficulty: 'average',
  modifiers: [],
  chance: 60,
  roll: 12,
  result: 'success',
  degree: 'special',
  combat: {
    role: 'attack',
    opponent: { reference: 'jussac', label: 'Jussac', rank: null },
    outcome: 'hit',
    damage: { weapon: 6, modifier: 2, armor: 1, total: 7, effect: 'impaling' },
  },
}

/** The dodge against the riposte, at 40%: a 30, the blow avoided. */
const DODGE: Roll = {
  ...ATTACK,
  skill: { reference: 'dodge', label: 'Dodge' },
  value: 40,
  baseChance: 40,
  chance: 40,
  roll: 30,
  result: 'success',
  degree: 'success',
  combat: {
    role: 'defense',
    opponent: { reference: 'cahusac', label: null, rank: 2 },
    defense: 'dodge',
    outcome: 'avoided',
  },
}

function live(
  status: LiveRoll['status'],
  overrides: Partial<Omit<LiveRoll, 'status'>> = {}
): LiveRoll {
  return {
    status,
    turnId: 'turn-1',
    roll: ROLL,
    done: [],
    queued: [],
    autoRoll: false,
    animated: true,
    ...overrides,
  } as LiveRoll
}

function render(state: LiveRoll): string {
  return renderToStaticMarkup(
    <RollCard live={state} onThrow={() => {}} onDiceStopped={() => {}} onFolded={() => {}} />
  )
}

/** The visible text, tags dropped. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('RollCard | set out', () => {
  test('shows what is rolled, the difficulty, the modifiers and the chance, part by part', () => {
    const markup = render(live('staged'))
    const text = textOf(markup)

    expect(text).toContain('Persuasion 60% Difficult Letter of introduction +10 Chance → 40%')
    expect(markup.match(/animate-fade-in/g)).toHaveLength(4)
    expect(markup).toContain('animation-delay:750ms')
  })

  test('waits for the player, without giving the d100 away', () => {
    const markup = render(live('staged'))

    expect(textOf(markup)).toContain('Roll the dice')
    expect(textOf(markup)).not.toContain('45')
    expect(markup).not.toContain('rolled')
  })

  test('thrown automatically, it has no button to press', () => {
    expect(textOf(render(live('staged', { autoRoll: true })))).not.toContain('Roll the dice')
  })

  test('without animation, every part shows at once', () => {
    const markup = render(live('staged', { animated: false }))

    expect(markup).not.toContain('animate-')
    expect(textOf(markup)).toContain('→ 40%')
  })
})

describe('RollCard | thrown', () => {
  test('the two dice run past their faces, the button gone', () => {
    const markup = render(live('rolling'))

    expect(markup.match(/animate-dice-spin/g)).toHaveLength(2)
    expect(textOf(markup)).not.toContain('Roll the dice')
    expect(textOf(markup)).not.toContain('Failure')
  })

  test('each die stops on its face of the d100: 40 and 5', () => {
    const markup = render(live('rolling'))

    // Two full turns of ten faces, then the face it stops on, a face's height apart.
    expect(markup).toContain('translateY(-504px)')
    expect(markup).toContain('translateY(-525px)')
    expect(markup).toContain('>40<')
    expect(markup).toContain('>5<')
  })

  test('the dice are hidden from screen readers', () => {
    const markup = render(live('rolling'))

    expect(markup).toMatch(/<div aria-hidden="true" class="flex gap-7">/)
  })
})

describe('RollCard | landed', () => {
  test('tells the d100 and the degree, the dice still', () => {
    const markup = render(live('landed'))

    expect(textOf(markup)).toContain('rolled 45 Failure')
    expect(markup).toContain('text-danger')
    expect(markup).not.toContain('animate-dice-spin')
    expect(markup).toContain('translateY(-525px)')
  })

  test('a critical glows and a fumble shakes', () => {
    const critical = render(
      live('landed', { roll: { ...ROLL, roll: 1, result: 'success', degree: 'critical' } })
    )
    const fumble = render(live('landed', { roll: { ...ROLL, roll: 99, degree: 'fumble' } }))

    expect(textOf(critical)).toContain('Critical success')
    expect(critical).toContain('shadow-')
    expect(critical).toContain('font-semibold')
    expect(fumble).toContain('animate-shake')
    expect(fumble).toContain('font-semibold')
  })
})

describe('RollCard | in combat', () => {
  test('an attack shows no damage before its dice have stopped', () => {
    for (const status of ['staged', 'rolling'] as const) {
      const text = textOf(render(live(status, { roll: ATTACK })))

      expect(text).not.toContain('Hit')
      expect(text).not.toContain('dealt')
    }
  })

  test('landed, an attack tells its outcome and the damage it dealt, in full', () => {
    const text = textOf(render(live('landed', { roll: ATTACK })))

    expect(text).toContain('rolled 12 Special success · Hit')
    expect(text).toContain('Damage 6 · Damage modifier +2 · Armor −1 · → 7 dealt · Impaling')
  })

  test('an attack that missed deals nothing', () => {
    const missed: Roll = {
      ...ATTACK,
      roll: 80,
      result: 'failure',
      degree: 'failure',
      combat: {
        role: 'attack',
        opponent: { reference: 'jussac', label: 'Jussac', rank: null },
        outcome: 'missed',
        damage: null,
      },
    }
    const text = textOf(render(live('landed', { roll: missed })))

    expect(text).toMatch(/^Attack on Jussac /)
    expect(text).toContain('rolled 80 Failure · Missed')
    expect(text).not.toContain('dealt')
  })

  test('a defence says which one and against whom from the start, and whether it held once landed', () => {
    const staged = textOf(render(live('staged', { roll: DODGE })))
    const landed = textOf(render(live('landed', { roll: DODGE })))

    expect(staged).toMatch(/^Dodge against unknown opponent 2 Dodge 40%/)
    expect(staged).not.toContain('Blow avoided')
    expect(landed).toContain('rolled 30 Success · Blow avoided')
  })
})
