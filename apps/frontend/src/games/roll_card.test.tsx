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
}

function live(
  status: LiveRoll['status'],
  overrides: Partial<Omit<LiveRoll, 'status'>> = {}
): LiveRoll {
  return { status, turnId: 'turn-1', roll: ROLL, autoRoll: false, animated: true, ...overrides }
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

    expect(text).toContain('Persuasion 60% Difficult Letter of introduction +10 → 40%')
    expect(markup.match(/animate-fade-in/g)).toHaveLength(4)
    expect(markup).toContain('animation-delay:750ms')
  })

  test('waits for the player, without giving the d100 away', () => {
    const markup = render(live('staged'))

    expect(textOf(markup)).toContain('Roll the dice')
    expect(textOf(markup)).not.toContain('45')
    expect(markup).not.toContain('rolled')
  })

  test('marks the chance on the gauge, and nothing else', () => {
    const markup = render(live('staged'))

    expect(markup).toContain('width:40%')
    expect(markup).toContain('left:40%')
    expect(markup).not.toContain('left:45%')
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
    expect(markup).toContain('animate-slide-in')
    expect(textOf(markup)).not.toContain('Roll the dice')
    expect(textOf(markup)).not.toContain('Failure')
  })

  test('each die stops on its face of the d100: 40 and 5', () => {
    const markup = render(live('rolling'))

    // Two full turns of ten faces, then the face it stops on, three rem apart.
    expect(markup).toContain('translateY(-72rem)')
    expect(markup).toContain('translateY(-75rem)')
    expect(markup).toContain('>40<')
    expect(markup).toContain('>5<')
  })

  test('the dice and the gauge are hidden from screen readers', () => {
    const markup = render(live('rolling'))

    expect(markup).toMatch(/<div aria-hidden="true" class="flex gap-3">/)
    expect(markup).toMatch(/<div aria-hidden="true" class="relative my-1/)
  })
})

describe('RollCard | landed', () => {
  test('tells the d100 and the degree, the dice still', () => {
    const markup = render(live('landed'))

    expect(textOf(markup)).toContain('rolled 45 · Failure')
    expect(markup).toContain('text-danger')
    expect(markup).not.toContain('animate-dice-spin')
    expect(markup).toContain('translateY(-75rem)')
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
