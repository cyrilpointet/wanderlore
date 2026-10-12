import type {
  ActionTypeContent,
  CombatProfile,
  Labels,
  ItemHolderReference,
  ItemModifier,
  NpcDisposition,
} from './content/types.js'

export {
  ITEM_CONDITIONS,
  NPC_DISPOSITIONS,
  type CombatProfile,
  type ItemCondition,
  type ItemHolderReference,
  type ItemModifier,
  type NpcDisposition,
} from './content/types.js'

/**
 * The world as a turn reads it: one world and one scenario, resolved into a
 * single definition by `resolveWorld`. Its content is stored in the content
 * tables (`#services/game/content/types`); this is the shape the pipeline,
 * the labels and the validators consume.
 *
 * Everything is in English, including skill references. Only the narration is
 * ever produced in the player's language.
 */

/**
 * A piece of world content: the stable reference the state and the model use,
 * and the names the player reads it by.
 *
 * `label` is the English name, which the model reads beside the reference;
 * `labels` holds every language, read through `ContentLabels` only.
 */
export type ContentEntry = {
  reference: string
  label: string
  labels: Labels
}

export type WorldSkill = ContentEntry & {
  /** Reference of the attribute the skill hangs off. */
  attribute: string
}

export type WorldDefinition = {
  reference: string
  label: string
  labels: Labels
  /** One line, handed to both steps so arbitration and narration agree on register. */
  tone: string
  /**
   * Facts that constrain what is *possible*. Arbitration only — the narrator
   * has no business ruling on plausibility.
   */
  rules: string[]
  /**
   * Sensory material for the narrator. Never sent to arbitration, which would
   * only pay for tokens it cannot act on.
   */
  ambiance: string[]
  attributes: ContentEntry[]
  skills: WorldSkill[]
  resources: ContentEntry[]
  /**
   * The categories arbitration picks from, each tied to the skill that
   * resolves it. Part of the world so a turn reads them from the same
   * snapshot as everything else.
   */
  actionTypes: ActionTypeContent[]
  /**
   * Closed catalogue of the people the scene can hold. The model picks from
   * it and never invents someone with state of their own.
   */
  npcs: NpcDefinition[]
  /**
   * Closed catalogue of places, named or generic. A place the model made up
   * would have no label to show.
   */
  locations: LocationDefinition[]
  /**
   * Closed catalogue of items. The model picks from it and never makes up an
   * item: one it invented would have no effect, no label and no translation.
   */
  items: ItemDefinition[]
  chapters: ContentEntry[]
  quests: ContentEntry[]
  /**
   * Proper names that are no entity of the game, the world's then the
   * scenario's. For the narrator only, in the game's language.
   */
  glossary: ContentEntry[]
}

type DescribedEntry = ContentEntry & {
  /** One line of English for the model, never shown to the player. */
  description: string
}

/**
 * A person of the world. A `unique` has at most one instance per game, an
 * `archetype` as many as the story needs. The improvised passer-by is an instance of a
 * `generic` archetype, with a free-text descriptor and no definition of its
 * own.
 */
export type NpcDefinition = DescribedEntry & {
  defaultDisposition: NpcDisposition
  combat: CombatProfile
} & ({ kind: 'unique' } | { kind: 'archetype'; generic: boolean })

/**
 * A place of the world. A unique place declares the place that contains it;
 * an archetype gets its parent per instance, picked from the unique places.
 * Every archetype serves improvised places, so none needs a `generic` flag.
 */
export type LocationDefinition = DescribedEntry &
  ({ kind: 'unique'; parent: string | null } | { kind: 'archetype' })

/**
 * An item of the world. A `unique` exists at most once per game; an
 * `archetype` as many times as the story needs, and a `generic` one stands for
 * whatever the player improvises, with a free-text descriptor and no
 * definition of its own. A `stackable` archetype is interchangeable — twenty
 * lead balls — and counts by quantity rather than by copy.
 */
export type ItemDefinition = DescribedEntry & {
  equippable: boolean
  modifiers: ItemModifier[]
} & (
    | { kind: 'unique'; initialHolder: ItemHolderReference | null }
    | { kind: 'archetype'; generic: boolean; stackable: boolean }
  )

export function skillReferences(world: WorldDefinition): string[] {
  return world.skills.map((skill) => skill.reference)
}

/** Every person the model may bring into a scene, unique or archetype. */
export function npcReferences(world: WorldDefinition): string[] {
  return world.npcs.map((npc) => npc.reference)
}

/**
 * Named places: the only destinations a movement may name directly, and the
 * parents an improvised place may hang from.
 */
export function uniqueLocationReferences(world: WorldDefinition): string[] {
  return world.locations
    .filter((location) => location.kind === 'unique')
    .map((location) => location.reference)
}

/** Every item an extraction may name, unique or archetype. */
export function itemReferences(world: WorldDefinition): string[] {
  return world.items.map((item) => item.reference)
}

/** Items that may come into being any number of times: archetypes, generic or not. */
export function itemArchetypeReferences(world: WorldDefinition): string[] {
  return world.items.filter((item) => item.kind === 'archetype').map((item) => item.reference)
}

/** Generic places an improvised location is an instance of. */
export function locationArchetypeReferences(world: WorldDefinition): string[] {
  return world.locations
    .filter((location) => location.kind === 'archetype')
    .map((location) => location.reference)
}
