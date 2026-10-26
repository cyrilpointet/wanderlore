import type { Labels, SkillCategory } from './content/types.js'
import type { ContentEntry, WorldDefinition } from './world.js'
import { networkPlaces } from './passages.js'

/**
 * A content reference paired with the label the player reads.
 *
 * The front never shows a reference, nor turns one into text itself: that
 * text depends on the world and on the language.
 */
export type Labelled = {
  reference: string
  label: string
}

export type LabelledValue = Labelled & {
  value: number
}

/** A place as a game holds it: the fields of a location instance its label depends on. */
export type PlacedLocation = {
  handle: string
  definitionReference: string
  parentReference: string | null
  name: string | null
}

export type ContentKind =
  'skill' | 'resource' | 'npc' | 'location' | 'location_archetype' | 'item' | 'chapter' | 'quest'

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
 * The name in the language asked for, or else in English: English is the one
 * language every name is written in.
 */
export function inLanguage(labels: Labels, language: string): string {
  return labels[language] ?? labels.en
}

/**
 * Labels for one world's content, in one language, read from its definition.
 *
 * The only place a response bound for the front — or a name bound for the
 * narrator — gets its label from. A name missing in the language falls back
 * on English; a reference missing from the world is a bug and throws.
 */
export class ContentLabels {
  readonly #world: WorldDefinition
  readonly #language: string
  readonly #entries: Record<ContentKind, Map<string, IndexedEntry>>
  /** The places of a network, by reference, and the place each stands in. */
  readonly #rooms: Map<string, string | null>

  constructor(world: WorldDefinition, language = 'en') {
    this.#world = world
    this.#language = language
    this.#entries = {
      skill: index(world.skills),
      resource: index(world.resources),
      npc: index(world.npcs),
      location: index(world.locations.filter((location) => location.kind === 'unique')),
      location_archetype: index(
        world.locations.filter((location) => location.kind === 'archetype')
      ),
      item: index(world.items),
      chapter: index(world.chapters),
      quest: index(world.quests),
    }

    const inNetwork = networkPlaces(world.locations)
    this.#rooms = new Map(
      world.locations.flatMap((location) =>
        location.kind === 'unique' && inNetwork.has(location.reference)
          ? [[location.reference, location.parent] as const]
          : []
      )
    )
  }

  world(): Labelled {
    return {
      reference: this.#world.reference,
      label: inLanguage(this.#world.labels, this.#language),
    }
  }

  of(kind: ContentKind, reference: string): Labelled {
    const { label } = this.#find(kind, reference)

    return { reference, label }
  }

  /**
   * Scores keyed by reference — a character's skills or resources —
   * labelled and put in the order the world declares them, so the sheet reads
   * the same from one request to the next whatever order the jsonb kept.
   */
  valued(kind: ContentKind, values: Record<string, number>): LabelledValue[] {
    return Object.entries(values)
      .map(([reference, value]) => ({ ...this.#find(kind, reference), reference, value }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ reference, label, value }) => ({ reference, label, value }))
  }

  /**
   * A place of the game, under its handle. A unique place reads as itself — a
   * room of a network within the place it stands in ("The kitchen · Ward
   * House"), since "The kitchen" alone says nothing of where; an improvised
   * one by its proper name, or else as its archetype within its parent
   * ("Tavern · Meung-sur-Loire"). The descriptor never leaves: it is English,
   * for the narrator.
   */
  location(place: PlacedLocation): Labelled {
    if (this.#entries.location.has(place.definitionReference)) {
      const { label } = this.#find('location', place.definitionReference)
      const within = this.#rooms.get(place.definitionReference)

      return {
        reference: place.handle,
        label: within ? `${label} · ${this.#find('location', within).label}` : label,
      }
    }

    const archetype = this.#find('location_archetype', place.definitionReference)

    if (place.name !== null) {
      return { reference: place.handle, label: place.name }
    }

    if (place.parentReference === null) {
      throw new Error(`Improvised place "${place.handle}" has neither a name nor a parent.`)
    }

    const parent = this.#find('location', place.parentReference)

    return { reference: place.handle, label: `${archetype.label} · ${parent.label}` }
  }

  /** The BRP category of a skill, for grouping the sheet. */
  categoryOf(skill: string): SkillCategory {
    this.#find('skill', skill)

    return this.#world.skills.find((entry) => entry.reference === skill)!.category
  }

  #find(kind: ContentKind, reference: string): FoundEntry {
    const entry = this.#entries[kind].get(reference)

    if (entry === undefined) {
      throw new MissingLabelError(this.#world.reference, kind, reference)
    }

    return { label: inLanguage(entry.labels, this.#language), rank: entry.rank }
  }
}

/** An entry as it was found: its name in the language asked for, and its rank. */
type FoundEntry = {
  label: string
  rank: number
}

type IndexedEntry = {
  labels: Labels
  /** Position in the world definition. */
  rank: number
}

function index(entries: ContentEntry[]): Map<string, IndexedEntry> {
  return new Map(entries.map((entry, rank) => [entry.reference, { labels: entry.labels, rank }]))
}
