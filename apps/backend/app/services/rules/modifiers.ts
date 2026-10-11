import type { AppliedModifier, ModifierSource, ModifierTarget } from './types.js'

/**
 * The item modifiers that apply to a roll or to a hit, read from what the
 * holder has — never proposed or priced by the model.
 *
 * - a modifier counts when it aims at the target and its condition holds:
 *   `owned` as soon as the item is held, `equipped` only while it is;
 * - a definition counts once, however many copies are held: two rapiers do
 *   not make a better swordsman. A copy equipped is enough for `equipped`.
 *
 * The sources are the holder's items that still exist; whoever else holds
 * something is not the caller's concern here.
 */
export function itemModifiers(
  sources: ModifierSource[],
  target: ModifierTarget
): AppliedModifier[] {
  const byReference = new Map<string, ModifierSource>()

  for (const source of sources) {
    const known = byReference.get(source.reference)

    byReference.set(source.reference, {
      ...source,
      equipped: source.equipped || (known?.equipped ?? false),
    })
  }

  return [...byReference.values()].flatMap((source) =>
    source.modifiers
      .filter((modifier) => aimsAt(modifier, target))
      .filter((modifier) => modifier.condition === 'owned' || source.equipped)
      .map((modifier) => ({
        source: 'item' as const,
        origin: source.reference,
        value: modifier.value,
      }))
  )
}

function aimsAt(modifier: ModifierTarget, target: ModifierTarget): boolean {
  if (modifier.target === 'damage' || target.target === 'damage') {
    return modifier.target === target.target
  }

  return modifier.skill === target.skill
}
