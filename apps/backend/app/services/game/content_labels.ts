import type { ContentEntry, WorldDefinition } from './world.js'

/**
 * A content reference paired with the label the player reads.
 *
 * The front never shows a reference, nor turns one into text itself: that
 * text depends on the world, and from Phase 5 on the language.
 */
export type Labelled = {
  reference: string
  label: string
}

export type ContentKind = 'attribute' | 'skill' | 'resource' | 'location' | 'chapter' | 'quest'

/**
 * A reference with no label is a bug — state written against a list it does
 * not belong to — not something to paper over. Showing the raw reference, or
 * prettifying it, would hide the bug and put an untranslatable string in front
 * of the player.
 */
export class MissingLabelError extends Error {
  readonly world: string
  readonly kind: ContentKind
  readonly reference: string

  constructor(world: string, kind: ContentKind, reference: string) {
    super(`No label for ${kind} "${reference}" in the ${world} world.`)
    this.name = 'MissingLabelError'
    this.world = world
    this.kind = kind
    this.reference = reference
  }
}

/**
 * Labels for one world's content, read from its definition.
 *
 * The only place a response bound for the front gets its labels from, so the
 * Phase 5 move to `display_names` and `glossary` stays behind this class.
 */
export class ContentLabels {
  readonly #world: WorldDefinition
  readonly #entries: Record<ContentKind, Map<string, string>>

  constructor(world: WorldDefinition) {
    this.#world = world
    this.#entries = {
      attribute: index(world.attributes),
      skill: index(world.skills),
      resource: index(world.resources),
      location: index(world.locations),
      chapter: index(world.chapters),
      quest: index(world.quests),
    }
  }

  world(): Labelled {
    return { reference: this.#world.reference, label: this.#world.label }
  }

  of(kind: ContentKind, reference: string): Labelled {
    const label = this.#entries[kind].get(reference)

    if (label === undefined) {
      throw new MissingLabelError(this.#world.reference, kind, reference)
    }

    return { reference, label }
  }
}

function index(entries: ContentEntry[]): Map<string, string> {
  return new Map(entries.map((entry) => [entry.reference, entry.label]))
}
