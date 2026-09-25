import type { Character, LabelledValue } from './queries'

/**
 * Purely visual derivations — layout, never game logic (front spec,
 * principle 1).
 */

export type AttributeGroup = LabelledValue & { skills: LabelledValue[] }

/** Each attribute with the character's skills under it, in the backend's order. */
export function groupSkills(character: Pick<Character, 'attributes' | 'skills'>): AttributeGroup[] {
  return character.attributes.map((attribute) => ({
    ...attribute,
    skills: character.skills
      .filter((skill) => skill.attribute === attribute.reference)
      .map(({ reference, label, value }) => ({ reference, label, value })),
  }))
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
