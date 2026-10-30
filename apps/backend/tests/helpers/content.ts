import db from '@adonisjs/lucid/services/db'

import ContentSeeder from '#database/seeders/01_content_seeder'
import ItemDefinition from '#models/item_definition'
import LocationDefinition from '#models/location_definition'
import NpcDefinition from '#models/npc_definition'
import { HOUSE_PLACES, IRON_KEY, STEWARD } from '#tests/helpers/places'

/**
 * Writes the game content a game reads — worlds, scenarios, catalogues and
 * categories of action — through the very seeder every environment runs, so
 * the functional suite plays against the real content.
 *
 * Called by the tests that need it rather than seeded globally: an implicit
 * fixture would hide which tests depend on it.
 */
export async function seedContent(): Promise<void> {
  await new ContentSeeder(db.connection()).run()
}

export type SeededGameContent = { worldId: string; scenarioId: string }

/**
 * Seeds the content and gives the world and scenario the demo game is played
 * from, for a test that starts a game in *The Three Musketeers*.
 */
export async function seedMusketeers(): Promise<SeededGameContent> {
  await seedContent()

  const world = await db.from('worlds').where('reference', 'three_musketeers').firstOrFail()
  const scenario = await db
    .from('scenarios')
    .where({ world_id: world.id, reference: 'a_gascon_in_paris' })
    .firstOrFail()

  return { worldId: world.id, scenarioId: scenario.id }
}

/**
 * The seeded *Three Musketeers*, with the house of the specs among the places
 * of *A Gascon in Paris*, its key among the items and its steward among the
 * people — for a test that plays a turn inside a network.
 */
export async function seedHouse(): Promise<SeededGameContent> {
  const content = await seedMusketeers()

  for (const place of HOUSE_PLACES) {
    await LocationDefinition.create({ ...place, ...content })
  }
  await ItemDefinition.create({ ...IRON_KEY, ...content })
  await NpcDefinition.create({ ...STEWARD, ...content })

  return content
}
