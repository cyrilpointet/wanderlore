import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { CharacterSheet } from './character_sheet'
import { Effects, RollChip } from './journal'
import { withCompletedTurn } from './game_cache'
import type { Character, Game, InventoryItem } from './queries'

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
    attributes: [{ reference: 'social', label: 'Social', value: 3 }],
    skills: [{ reference: 'persuasion', label: 'Persuasion', value: 3, attribute: 'social' }],
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

describe('Journal | items', () => {
  test('the roll names the item that weighed, never a number', () => {
    const text = textOf(
      renderToStaticMarkup(
        <RollChip
          roll={{
            skill: { reference: 'persuasion', label: 'Persuasion' },
            result: 'success',
            margin: 'comfortable',
            items: [{ reference: 'letter_to_treville', label: 'Letter for M. de Tréville' }],
          }}
        />
      )
    )

    expect(text).toBe('Persuasion · Clear success · with Letter for M. de Tréville')
  })

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
    expect(after.pendingTurn).toBeNull()
  })
})
