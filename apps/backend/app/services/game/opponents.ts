import type { ContentLabels } from './content_labels.js'
import type { WorldDefinition } from './world.js'

/**
 * Whom a roll of the character was made against, as the player may know them:
 * by name when the character knows it, or else as the n-th unknown opponent —
 * the front words it. Never the name of a unique person whose name they do
 * not know.
 */
export type NamedOpponent = {
  /** The handle of the person in the game. */
  reference: string
  label: string | null
  /** Set when the label is not: who they are among the unknown, from 1. */
  rank: number | null
}

/** A person of the game as their name depends on it. */
export type MetPerson = {
  handle: string
  definitionReference: string
  name: string | null
}

/**
 * The people of a game as the player may name them. Pure: `loadOpponents`
 * (`#services/game/npcs`) reads them.
 *
 * The rank of an unknown person is their place among the unique people the
 * game brought in, in that order, leaving out those the character knew from
 * the start: it never moves, not even when someone before them gives their
 * name. An archetype is always known — by the name given in play, or else by
 * its definition.
 */
export class Opponents {
  readonly #labels: ContentLabels
  readonly #world: WorldDefinition
  readonly #people: Map<string, MetPerson>
  readonly #ranks: Map<string, number>
  readonly #known: Set<string>

  constructor(
    labels: ContentLabels,
    world: WorldDefinition,
    /** In the order the game brought them in. */
    people: MetPerson[],
    known: { initially: string[]; now: string[] }
  ) {
    this.#labels = labels
    this.#world = world
    this.#people = new Map(people.map((person) => [person.handle, person]))
    this.#known = new Set(known.now)

    const initially = new Set(known.initially)
    const ranked = people.filter(
      ({ definitionReference }) =>
        this.#isUnique(definitionReference) && !initially.has(definitionReference)
    )
    this.#ranks = new Map(ranked.map(({ handle }, index) => [handle, index + 1]))
  }

  /**
   * Someone by handle. `provisional` is the archetype of an opponent the
   * round brings in, who has no instance until the turn is applied.
   */
  of(handle: string, provisional: string | null = null): NamedOpponent {
    const person = this.#people.get(handle)
    const definition = person?.definitionReference ?? provisional

    if (definition === null) {
      throw new Error(`No one by the handle "${handle}" in this game.`)
    }

    if (this.#isUnique(definition) && !this.#known.has(definition)) {
      const rank = this.#ranks.get(handle)

      if (rank === undefined) {
        throw new Error(`No rank for the unknown "${handle}" in this game.`)
      }

      return { reference: handle, label: null, rank }
    }

    return {
      reference: handle,
      label: person?.name ?? this.#labels.of('npc', definition).label,
      rank: null,
    }
  }

  #isUnique(definition: string): boolean {
    return this.#world.npcs.find(({ reference }) => reference === definition)?.kind === 'unique'
  }
}
