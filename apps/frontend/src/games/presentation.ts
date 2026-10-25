import { SKILL_CATEGORIES, type SkillCategory } from '@/api/enums'
import type { Character, InventoryItem, LabelledValue } from './queries'

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

/** How full a gauge is drawn, as a percentage between 0 and 100. */
export function gaugePercent(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (current / max) * 100))
}

/**
 * A stack shows how many there are, even one; a copy is one of a kind and
 * shows no count.
 */
export function showsQuantity(item: Pick<InventoryItem, 'handle' | 'quantity'>): boolean {
  return item.handle === null || item.quantity > 1
}
