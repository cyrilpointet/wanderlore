import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { CharacterSheet } from './character_sheet'
import { Effects, RollChip } from './journal'
import { withCompletedTurn } from './game_cache'
import type { Character, Game, InventoryItem, Roll } from './queries'

/**
 * Rendered to static markup: enough to read what the player is shown,
 * without a browser.
 */
const LETTER: InventoryItem = {
  handle: 'letter_to_treville',
  item: { reference: 'letter_to_treville', label: 'Letter for M. de Tréville' },
  quantity: 1,
  equipped: false,
}
const RAPIER: InventoryItem = {
  handle: 'rapier_1',
  item: { reference: 'rapier', label: 'Rapier' },
  quantity: 1,
  equipped: true,
}
const SHOT: InventoryItem = {
  handle: null,
  item: { reference: 'lead_shot', label: 'Lead shot' },
  quantity: 6,
  equipped: false,
}

function character(inventory: InventoryItem[]): Character {
  return {
    name: "d'Artagnan",
    hitPoints: 10,
    hitPointsMax: 10,
    characteristics: [
      { reference: 'STR', value: 13 },
      { reference: 'CON', value: 14 },
      { reference: 'SIZ', value: 12 },
      { reference: 'INT', value: 13 },
      { reference: 'POW', value: 12 },
      { reference: 'DEX', value: 16 },
      { reference: 'CHA', value: 14 },
    ],
    skills: [{ reference: 'persuasion', label: 'Persuasion', value: 45, category: 'communication' }],
    resources: [],
    inventory,
  }
}

function game(inventory: InventoryItem[]): Game {
  return {
    id: 'game-1',
    status: 'in_progress',
    lastActivityAt: '2026-10-11T10:00:00Z',
    world: { reference: 'three_musketeers', label: 'The Three Musketeers' },
    chapter: null,
    character: character(inventory),
    location: { reference: 'paris', label: 'Paris' },
    period: 'afternoon',
    activeQuests: [],
    pendingTurn: null,
  }
}

/** The visible text, tags dropped. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('Character sheet | inventory tab', () => {
  test('opens on the character, with the inventory one tab away', () => {
    const markup = renderToStaticMarkup(<CharacterSheet game={game([LETTER])} />)

    expect(markup).toContain('role="tablist"')
    expect(textOf(markup)).toContain('Inventory')
    expect(textOf(markup)).toContain('Persuasion')
    expect(textOf(markup)).not.toContain('Letter for M. de Tréville')
  })

  test('keeps the quests under way for their own tab, the place left to the scene bar', () => {
    const quest = {
      reference: 'deliver_the_letter',
      label: 'Deliver the letter',
      summary: 'Carry the letter to Tréville.',
    }
    const withQuest = { ...game([]), activeQuests: [quest] }

    const character = textOf(renderToStaticMarkup(<CharacterSheet game={withQuest} />))
    const quests = textOf(
      renderToStaticMarkup(<CharacterSheet game={withQuest} initialTab="quests" />)
    )

    expect(character).toContain('Quests')
    expect(character).not.toContain('Deliver the letter')
    expect(quests).toContain('Deliver the letter')
    expect(quests).toContain('Carry the letter to Tréville.')
    expect(quests).not.toContain('Persuasion')
    expect(quests).not.toContain('Paris')
    expect(quests).not.toContain('Afternoon')
  })

  test('says so when no quest is under way', () => {
    const markup = renderToStaticMarkup(<CharacterSheet game={game([])} initialTab="quests" />)

    expect(textOf(markup)).toContain('No quest under way.')
  })

  test('says so when the character carries nothing', () => {
    const markup = renderToStaticMarkup(<CharacterSheet game={game([])} initialTab="inventory" />)

    expect(textOf(markup)).toContain('You carry nothing.')
  })

  test('lists what is carried, a stack with its count, what is drawn marked', () => {
    const text = textOf(
      renderToStaticMarkup(
        <CharacterSheet game={game([LETTER, RAPIER, SHOT])} initialTab="inventory" />
      )
    )

    expect(text).toContain('Letter for M. de Tréville')
    expect(text).toContain('Lead shot ×6')
    expect(text).toContain('Rapier Equipped')
    /** A single copy carries no count. */
    expect(text).not.toContain('Rapier ×1')
    expect(text.match(/Equipped/g)).toHaveLength(1)
  })
})

const PERSUASION: Roll = {
  skill: { reference: 'persuasion', label: 'Persuasion' },
  characteristic: null,
  value: 60,
  baseChance: 60,
  difficulty: 'average',
  modifiers: [],
  chance: 60,
  roll: 42,
  result: 'success',
  degree: 'success',
}

describe('Journal | the roll in full', () => {
  test('a plain roll: the skill at its value, the d100 and the degree', () => {
    const text = textOf(renderToStaticMarkup(<RollChip roll={PERSUASION} />))

    expect(text).toBe('Persuasion 60% · rolled 42 · Success')
  })

  test('every modifier with its value, a circumstance by its label, then the chance', () => {
    const text = textOf(
      renderToStaticMarkup(
        <RollChip
          roll={{
            ...PERSUASION,
            difficulty: 'difficult',
            modifiers: [
              { source: 'contextual', effect: 'minor_bonus', value: 10 },
              {
                source: 'item',
                item: { reference: 'letter_to_treville', label: 'Letter for M. de Tréville' },
                value: 10,
              },
            ],
            chance: 50,
            roll: 8,
            degree: 'special',
          }}
        />
      )
    )

    expect(text).toBe(
      'Persuasion 60% · Difficult · Advantage +10 · Letter for M. de Tréville +10 · → 50% · rolled 8 · Special success'
    )
  })

  test('a characteristic roll: its score times five, labelled by the front', () => {
    const text = textOf(
      renderToStaticMarkup(
        <RollChip
          roll={{
            ...PERSUASION,
            skill: null,
            characteristic: 'CHA',
            value: 14,
            baseChance: 70,
            chance: 70,
            roll: 100,
            result: 'failure',
            degree: 'fumble',
          }}
        />
      )
    )

    expect(text).toBe('Charisma 14 ×5 · → 70% · rolled 100 · Fumble')
  })
})

describe('Journal | items', () => {

  test('tells what happened to the character’s items, and with whom', () => {
    const text = textOf(
      renderToStaticMarkup(
        <Effects
          effects={{
            hitPointsDelta: 0,
            movement: null,
            items: [
              {
                change: 'gained',
                item: { reference: 'food', label: 'Food' },
                quantity: 2,
                counterpart: null,
              },
              {
                change: 'lost',
                item: { reference: 'letter_to_treville', label: 'Letter for M. de Tréville' },
                quantity: 1,
                counterpart: { reference: 'rochefort', label: 'Rochefort' },
              },
              {
                change: 'gained',
                item: { reference: 'common_sword', label: 'Sword' },
                quantity: 1,
                counterpart: { reference: 'cardinal_guard_1', label: 'Bernajoux' },
              },
              {
                change: 'used_up',
                item: { reference: 'lead_shot', label: 'Lead shot' },
                quantity: 1,
                counterpart: null,
              },
              {
                change: 'equipped',
                item: { reference: 'common_sword', label: 'Sword' },
                quantity: 1,
                counterpart: null,
              },
            ],
          }}
        />
      )
    )

    expect(text).toContain('You gain Food ×2')
    expect(text).toContain('Letter for M. de Tréville goes to Rochefort')
    expect(text).toContain('You get Sword from Bernajoux')
    expect(text).toContain('You use up Lead shot')
    expect(text).toContain('You equip Sword')
  })
})

describe('A completed turn', () => {
  test('puts the sheet it carries in place, inventory included', () => {
    const before = game([LETTER, RAPIER])
    const after = withCompletedTurn(before, character([RAPIER, SHOT]), undefined)

    expect(after.character.inventory).toEqual([RAPIER, SHOT])
    /** No badge in the event: the place stays as it was. */
    expect(after.location).toEqual(before.location)
    expect(after.period).toBe('afternoon')
    expect(after.pendingTurn).toBeNull()
  })

  test('takes the period of the day the turn ended in', () => {
    const after = withCompletedTurn(game([]), character([]), null, 'night')

    expect(after.period).toBe('night')
    expect(after.location).toBeNull()
  })
})

describe('CharacterSheet | the BRP sheet', () => {
  test('shows the seven characteristics, then the skills in percent by category', () => {
    const text = textOf(renderToStaticMarkup(<CharacterSheet game={game([])} />))

    for (const shown of ['Characteristics', 'Strength13', 'Dexterity16', 'Charisma14']) {
      expect(text.replace(/\s+/g, '')).toContain(shown)
    }
    expect(text).toContain('Communication')
    expect(text.replace(/\s+/g, '')).toContain('Persuasion45%')
  })
})
