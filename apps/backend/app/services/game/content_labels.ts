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

export type LabelledValue = Labelled & {
  value: number
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
  readonly #entries: Record<ContentKind, Map<string, IndexedEntry>>

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
    const { label } = this.#find(kind, reference)

    return { reference, label }
  }

  /**
   * Scores keyed by reference — a character's attributes, skills or resources —
   * labelled and put in the order the world declares them, so the sheet reads
   * the same from one request to the next whatever order the jsonb kept.
   */
  valued(kind: ContentKind, values: Record<string, number>): LabelledValue[] {
    return Object.entries(values)
      .map(([reference, value]) => ({ ...this.#find(kind, reference), reference, value }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ reference, label, value }) => ({ reference, label, value }))
  }

  /** Reference of the attribute a skill hangs off, for grouping the sheet. */
  attributeOf(skill: string): string {
    this.#find('skill', skill)

    return this.#world.skills.find((entry) => entry.reference === skill)!.attribute
  }

  #find(kind: ContentKind, reference: string): IndexedEntry {
    const entry = this.#entries[kind].get(reference)

    if (entry === undefined) {
      throw new MissingLabelError(this.#world.reference, kind, reference)
    }

    return entry
  }
}

type IndexedEntry = {
  label: string
  /** Position in the world definition. */
  rank: number
}

function index(entries: ContentEntry[]): Map<string, IndexedEntry> {
  return new Map(entries.map((entry, rank) => [entry.reference, { label: entry.label, rank }]))
}
