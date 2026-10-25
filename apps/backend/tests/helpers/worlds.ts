import { resolveWorld } from '#services/game/content/resolve'
import type { Characteristics } from '#services/rules/types'
import type { ContentEntry, WorldDefinition } from '#services/game/world'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'

/**
 * *The Three Musketeers* as a turn reads it, resolved from the content the
 * seeder writes — for the specs that hand a world to a service directly,
 * without the database. A turn loads its own from the database.
 */
export const THREE_MUSKETEERS: WorldDefinition = resolveWorld(
  THREE_MUSKETEERS_CONTENT,
  THREE_MUSKETEERS_CONTENT.scenarios[0]
)

/**
 * The characteristics of a sheet a spec writes by hand: d'Artagnan's, as the
 * scenario gives them. CON 14 and SIZ 12 make 13 hit points.
 */
export const GASCON: Characteristics = {
  STR: 13,
  CON: 14,
  SIZ: 12,
  INT: 13,
  POW: 12,
  DEX: 16,
  CHA: 14,
}

/** Adds a French name to the entries of a list it has one for. */
function translated<Entry extends ContentEntry>(entries: Entry[], french: Record<string, string>) {
  return entries.map((entry) =>
    french[entry.reference]
      ? { ...entry, labels: { ...entry.labels, fr: french[entry.reference] } }
      : entry
  )
}

/**
 * The same world with a few French names, and a glossary with one entry
 * translated and one not — for the specs about languages. Anything left
 * untranslated falls back on English.
 */
export const THREE_MUSKETEERS_IN_FRENCH: WorldDefinition = {
  ...THREE_MUSKETEERS,
  labels: { ...THREE_MUSKETEERS.labels, fr: 'Les Trois Mousquetaires' },
  skills: translated(THREE_MUSKETEERS.skills, {
    persuasion: 'Persuasion',
    swordsmanship: 'Escrime',
  }),
  npcs: translated(THREE_MUSKETEERS.npcs, {
    treville: 'M. de Tréville',
    royal_guard: 'Garde du Roi',
  }),
  locations: translated(THREE_MUSKETEERS.locations, {
    hotel_de_treville: 'Hôtel de Tréville',
    paris: 'Paris',
    tavern: 'Taverne',
  }),
  items: translated(THREE_MUSKETEERS.items, { rapier: 'Rapière', dagger: 'Dague' }),
  glossary: [
    {
      reference: 'cardinals_guards',
      label: "the Cardinal's Guards",
      labels: { en: "the Cardinal's Guards", fr: 'les gardes du Cardinal' },
    },
    {
      reference: 'kings_musketeers',
      label: "the King's Musketeers",
      labels: { en: "the King's Musketeers" },
    },
  ],
}
