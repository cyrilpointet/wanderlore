import { SKILL_CATEGORIES, type SkillCategory } from '@/api/enums'
import type { Character, InventoryItem, LabelledValue, Turn } from './queries'

/**
 * Purely visual derivations — layout, never game logic (front spec,
 * principle 1).
 */

export type SkillGroup = { category: SkillCategory; skills: LabelledValue[] }

/**
 * The character's skills under their BRP category, in the fixed order of the
 * categories, the skills in the backend's order. A category with no skill of
 * theirs is left out.
 */
export function groupSkills(character: Pick<Character, 'skills'>): SkillGroup[] {
  return SKILL_CATEGORIES.map((category) => ({
    category,
    skills: character.skills
      .filter((skill) => skill.category === category)
      .map(({ reference, label, value }) => ({ reference, label, value })),
  })).filter((group) => group.skills.length > 0)
}

/**
 * The narration's paragraphs. Line breaks are the only formatting the
 * narration carries: no Markdown, no HTML (front spec, section 7).
 */
export function paragraphs(narration: string): string[] {
  return narration
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/**
 * What the game master told in a turn, as it is read aloud and announced:
 * the narration, then — on the turn that ended the game — the epilogue.
 */
export function toldText(turn: Pick<Turn, 'narration' | 'gameEnd'>): string | null {
  const told = [turn.narration, turn.gameEnd?.epilogue].filter(Boolean).join('\n\n')
  return told || null
}

/** How many hit-point pips are drawn filled: the points left, within the pips there are. */
export function filledPips(current: number, max: number): number {
  return Math.min(Math.max(current, 0), Math.max(max, 0))
}

/**
 * A stack shows how many there are, even one; a copy is one of a kind and
 * shows no count.
 */
export function showsQuantity(item: Pick<InventoryItem, 'handle' | 'quantity'>): boolean {
  return item.handle === null || item.quantity > 1
}

/**
 * The d100 the backend drew, as the two d10 of the table show it: the tens
 * die from `00` to `90`, the units die from `0` to `9`, a hundred reading
 * `00` and `0`. A matter of display, not of rules.
 */
export function percentileDice(roll: number): { tens: number; units: number } {
  return { tens: Math.floor((roll % 100) / 10), units: roll % 10 }
}
