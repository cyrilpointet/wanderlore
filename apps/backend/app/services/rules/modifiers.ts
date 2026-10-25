import type { AppliedModifier, ModifierSource, ModifierTarget } from './types.js'

/**
 * The item modifiers that apply to a roll, read from what the holder has —
 * never proposed or priced by the model.
 *
 * - a modifier counts when it aims at the skill rolled and its condition
 *   holds: `owned` as soon as the item is held, `equipped` only while it is;
 * - a definition counts once, however many copies are held: two lockpicks do
 *   not make a better burglar. A copy equipped is enough for `equipped`.
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
      .filter((modifier) => modifier.skill === target.skill)
      .filter((modifier) => modifier.condition === 'owned' || source.equipped)
      .map((modifier) => ({
        source: 'item' as const,
        origin: source.reference,
        value: modifier.value,
      }))
  )
}
