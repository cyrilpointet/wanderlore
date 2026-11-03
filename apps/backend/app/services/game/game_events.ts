import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import EventState from '#models/event_state'
import InventoryItem from '#models/inventory_item'
import LocationInstance from '#models/location_instance'
import NpcInstance from '#models/npc_instance'
import PlaceNote from '#models/place_note'
import type WorldState from '#models/world_state'

import { NOT_STARTED, type EventProgress, type SnapshotItem, type WorldSnapshot } from './events.js'
import type { WorldDefinition } from './world.js'

/**
 * What a game holds of the events of its scenario (roadmap, Phase 11), read
 * for the pure rules of `#services/game/events` and `#services/game/schedules`
 * to work on. Reads only: what changes is written by
 * `#services/game/apply_events`.
 */

/** What became of each event the game armed, set off or saw cancelled, by reference. */
export async function loadProgress(
  sessionId: string,
  client?: QueryClientContract
): Promise<Map<string, EventState>> {
  const rows = await EventState.query({ client }).where('sessionId', sessionId)

  return new Map(rows.map((row) => [row.eventReference, row]))
}

export function progressReader(
  rows: Map<string, EventState>
): (reference: string) => EventProgress {
  return (reference) => {
    const row = rows.get(reference)

    return row === undefined
      ? NOT_STARTED
      : { armedAt: row.armedAt, firedAt: row.firedAt, cancelledAt: row.cancelledAt }
  }
}

/** The unique people whose schedule an event that fell stopped for good. */
export function stoppedSchedules(
  world: WorldDefinition,
  rows: Map<string, EventState>
): Set<string> {
  return new Set(
    world.events
      .filter((event) => (rows.get(event.reference)?.firedAt ?? null) !== null)
      .flatMap((event) => event.effects)
      .flatMap((effect) => (effect.type === 'schedule_stopped' ? [effect.npc] : []))
  )
}

/**
 * What the conditions of the events read of a game, as it stands: the flags
 * of `worldState` as the turn holds them — set this turn included — and the
 * rest as the database does, within `client`'s transaction.
 */
export async function loadSnapshot(
  world: WorldDefinition,
  sessionId: string,
  worldState: Pick<WorldState, 'narrativeFlags'>,
  client?: QueryClientContract
): Promise<WorldSnapshot> {
  const uniqueNpcs = world.npcs
    .filter(({ kind }) => kind === 'unique')
    .map(({ reference }) => reference)
  const uniqueItems = world.items
    .filter(({ kind }) => kind === 'unique')
    .map(({ reference }) => reference)

  const places = await LocationInstance.query({ client }).where('sessionId', sessionId)
  const npcs =
    uniqueNpcs.length === 0
      ? []
      : await NpcInstance.query({ client })
          .where('sessionId', sessionId)
          .whereIn('handle', uniqueNpcs)
          .preload('location')
  const items =
    uniqueItems.length === 0
      ? []
      : await InventoryItem.query({ client })
          .where('sessionId', sessionId)
          .whereIn('handle', uniqueItems)
          .preload('npcInstance')
          .preload('locationInstance')

  return {
    flags: new Set(
      Object.entries(worldState.narrativeFlags ?? {})
        .filter(([, value]) => value === true)
        .map(([flag]) => flag)
    ),
    visited: new Set(places.map(({ handle }) => handle)),
    npcs: new Map(
      npcs.map((npc) => [
        npc.handle,
        {
          status: npc.status,
          disposition: npc.disposition,
          place: npc.location?.handle ?? null,
        },
      ])
    ),
    items: new Map(items.map((item) => [item.handle!, snapshotItemOf(item)])),
  }
}

function snapshotItemOf(item: InventoryItem): SnapshotItem {
  const holder: SnapshotItem['holder'] =
    item.characterId !== null
      ? { holder: 'character' }
      : item.npcInstanceId !== null
        ? { holder: 'npc', reference: item.npcInstance.handle }
        : item.locationInstanceId !== null
          ? { holder: 'location', reference: item.locationInstance.handle }
          : null

  return { holder, gone: item.state === 'gone' }
}

/**
 * The place a scene stands in, then every place containing it: where an
 * event must happen for the character to see it. An improvised place counts
 * as the named place it stands in.
 */
export function placesAround(
  world: WorldDefinition,
  place: { definitionReference: string; parentReference: string | null } | null
): string[] {
  if (place === null) {
    return []
  }

  const definitionOf = (reference: string) =>
    world.locations.find((location) => location.reference === reference)
  const start =
    definitionOf(place.definitionReference)?.kind === 'unique'
      ? place.definitionReference
      : place.parentReference
  const around: string[] = []

  for (let reference = start; reference !== null && !around.includes(reference);) {
    around.push(reference)
    const definition = definitionOf(reference)
    reference = definition?.kind === 'unique' ? definition.parent : null
  }

  return around
}

/** The note an event left on a unique place, if any. */
export async function placeNoteOf(
  sessionId: string,
  reference: string,
  client?: QueryClientContract
): Promise<string | null> {
  const note = await PlaceNote.query({ client })
    .where('sessionId', sessionId)
    .where('locationReference', reference)
    .first()

  return note?.note ?? null
}

/**
 * The events the state set off at the end of an earlier turn, where the
 * character was to see them, that no narration has told yet: the next one
 * does, once.
 */
export function untoldEvents(world: WorldDefinition, rows: Map<string, EventState>) {
  return world.events.filter((event) => {
    const row = rows.get(event.reference)

    return row !== undefined && row.firedAt !== null && row.witnessed && !row.told
  })
}

/**
 * The events that fell after the last turn a summary covers, in the order
 * they fell: facts of the world for arbitration, until a summary takes over
 * their turn.
 */
export function eventsSince(
  world: WorldDefinition,
  rows: Map<string, EventState>,
  coveredUpTo: number
) {
  return world.events
    .map((event) => ({ event, row: rows.get(event.reference) }))
    .filter(
      ({ row }) =>
        row !== undefined &&
        row.firedAt !== null &&
        row.turnNumber !== null &&
        row.turnNumber > coveredUpTo
    )
    .sort((a, b) => a.row!.firedAt! - b.row!.firedAt!)
    .map(({ event }) => event)
}
