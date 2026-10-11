import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import InventoryItem from '#models/inventory_item'
import NpcInstance from '#models/npc_instance'

import type { ItemDefinition, WorldDefinition } from './world.js'

/**
 * Who holds an item: the character, someone of the game, or a place. Always
 * an instance — a person or a place the game has met — by its row id.
 */
export type Holder =
  { type: 'character'; id: string } | { type: 'npc'; id: string } | { type: 'location'; id: string }

/** An item coming into being, as the extraction step will propose it. */
export type NewItem = {
  /** From the closed list of item definitions. */
  definition: string
  /** Free English text with no mechanical reach: "a three-legged stool". */
  descriptor: string | null
  quantity: number
}

/**
 * An item as the turn context carries it. A copy is designated by its handle;
 * a stack, which has none, by its definition and its holder.
 */
export type HeldItem = {
  handle: string | null
  definition: string
  descriptor: string | null
  quantity: number
  equipped: boolean
}

/**
 * The items a turn can see and move: the character's, those of the people
 * present, and those left in the place the game stands in. Anything else
 * follows its holder out of the scene.
 */
export type ItemsInScene = {
  character: HeldItem[]
  /** Only the people present who hold something, in the order they came in. */
  npcs: { handle: string; items: HeldItem[] }[]
  location: HeldItem[]
}

/**
 * A definition outside the closed list. It is checked before anything is
 * applied, so reaching this is a bug upstream — never a reason to create an
 * item nothing defines.
 */
export class UnknownItemError extends Error {
  readonly world: string
  readonly reference: string

  constructor(world: string, reference: string) {
    super(`"${reference}" is not an item definition of the ${world} world.`)
    this.name = 'UnknownItemError'
    this.world = world
    this.reference = reference
  }
}

export type ItemRefusal =
  'unique_exists' | 'invalid_quantity' | 'not_equippable' | 'not_held_by_character' | 'gone'

/**
 * An operation the rules of the inventory forbid. Like an unknown definition,
 * the validation step is meant to catch it first; this is the last line of
 * defence, and it leaves the item untouched.
 */
export class ItemRefusedError extends Error {
  readonly reason: ItemRefusal
  readonly item: string

  constructor(reason: ItemRefusal, item: string, detail: string) {
    super(`Refused on "${item}": ${detail}`)
    this.name = 'ItemRefusedError'
    this.reason = reason
    this.item = item
  }
}

/**
 * Brings an item into being, held by someone or something.
 *
 * - a unique item exists once per game: a second one is refused, even after
 *   the first was destroyed;
 * - a copy of an archetype gets its own row and a handle numbered by the
 *   backend within the game (`rapier_1`, `rapier_2`), never by the model;
 * - a stack is added to what the holder already has of it.
 *
 * Turns of a game are played one at a time, so counting is enough to number;
 * the unique `(session_id, handle)` is the last line of defence.
 */
export async function createItem(
  world: WorldDefinition,
  sessionId: string,
  entry: NewItem,
  holder: Holder,
  client?: QueryClientContract
): Promise<InventoryItem> {
  const definition = findDefinition(world, entry.definition)
  checkQuantity(definition, entry.quantity, entry.definition)

  if (isStackable(definition)) {
    const stack = await findStack(sessionId, holder, definition.reference, client)

    if (stack !== null) {
      stack.merge({
        quantity: stack.quantity + entry.quantity,
        state: 'carried',
        descriptor: stack.descriptor ?? entry.descriptor,
      })
      await stack.save()

      return stack
    }

    return InventoryItem.create(
      {
        sessionId,
        ...holderColumns(holder),
        handle: null,
        definitionReference: definition.reference,
        descriptor: entry.descriptor,
        quantity: entry.quantity,
        state: 'carried',
      },
      { client }
    )
  }

  let handle = definition.reference

  if (definition.kind === 'unique') {
    const existing = await InventoryItem.query({ client })
      .where('sessionId', sessionId)
      .where('handle', handle)
      .first()

    if (existing !== null) {
      throw new ItemRefusedError('unique_exists', handle, 'a unique item exists once per game.')
    }
  } else {
    handle = `${definition.reference}_${(await countOf(sessionId, definition.reference, client)) + 1}`
  }

  return InventoryItem.create(
    {
      sessionId,
      ...holderColumns(holder),
      handle,
      definitionReference: definition.reference,
      descriptor: entry.descriptor,
      quantity: 1,
      state: 'carried',
    },
    { client }
  )
}

/**
 * Hands an item over: given, taken, stolen, hidden, picked up. It is never a
 * loss — the item keeps existing, with someone else.
 *
 * A copy keeps its handle, whoever holds it. A stack is split or merged: what
 * moves joins what the new holder already has of it. An item leaving the
 * character's hands is no longer equipped.
 *
 * Returns the row that now holds what moved.
 */
export async function transferItem(
  world: WorldDefinition,
  item: InventoryItem,
  to: Holder,
  quantity: number,
  client?: QueryClientContract
): Promise<InventoryItem> {
  const definition = findDefinition(world, item.definitionReference)
  checkPresent(item)
  checkQuantity(definition, quantity, label(item))

  if (quantity > item.quantity) {
    throw new ItemRefusedError(
      'invalid_quantity',
      label(item),
      `cannot hand over ${quantity} out of ${item.quantity}.`
    )
  }

  if (isHeldBy(item, to)) {
    return item
  }

  if (!isStackable(definition)) {
    item.merge({ ...holderColumns(to), state: 'carried' })
    await item.save()

    return item
  }

  const target = await findStack(item.sessionId, to, item.definitionReference, client)

  if (target === null && quantity === item.quantity) {
    item.merge({ ...holderColumns(to), state: 'carried' })
    await item.save()

    return item
  }

  let received: InventoryItem

  if (target === null) {
    received = await InventoryItem.create(
      {
        sessionId: item.sessionId,
        ...holderColumns(to),
        handle: null,
        definitionReference: item.definitionReference,
        descriptor: item.descriptor,
        quantity,
        state: 'carried',
      },
      { client }
    )
  } else {
    /** A stack emptied earlier is gone with nothing in it, and comes back here. */
    target.merge({ quantity: target.quantity + quantity, state: 'carried' })
    await target.save()
    received = target
  }

  await takeAway(item, quantity)

  return received
}

/**
 * Destroys or consumes an item: a shot fired, a ration eaten, a letter
 * burnt. All of it gone, the row stays, marked `gone`, with its last holder.
 */
export async function destroyItem(
  world: WorldDefinition,
  item: InventoryItem,
  quantity: number
): Promise<InventoryItem> {
  const definition = findDefinition(world, item.definitionReference)
  checkPresent(item)
  checkQuantity(definition, quantity, label(item))

  if (quantity > item.quantity) {
    throw new ItemRefusedError(
      'invalid_quantity',
      label(item),
      `cannot destroy ${quantity} out of ${item.quantity}.`
    )
  }

  await takeAway(item, quantity)

  return item
}

/**
 * Only the character equips, and only what can be worn or wielded. There is
 * no slot: the rules count a definition once per roll, however many copies
 * are equipped.
 */
export async function equipItem(world: WorldDefinition, item: InventoryItem): Promise<void> {
  const definition = findDefinition(world, item.definitionReference)
  checkPresent(item)

  if (item.characterId === null) {
    throw new ItemRefusedError(
      'not_held_by_character',
      label(item),
      'only the character equips an item.'
    )
  }

  if (!definition.equippable) {
    throw new ItemRefusedError('not_equippable', label(item), 'it cannot be worn or wielded.')
  }

  item.state = 'equipped'
  await item.save()
}

export async function unequipItem(item: InventoryItem): Promise<void> {
  checkPresent(item)

  if (item.characterId === null) {
    throw new ItemRefusedError(
      'not_held_by_character',
      label(item),
      'only the character equips an item.'
    )
  }

  item.state = 'carried'
  await item.save()
}

/**
 * Brings into the game the unique items a character or a place holds from
 * the start, the first time the game meets them. Safe to call on every
 * meeting: a unique item that already exists — wherever it went since — is
 * never created again.
 */
export async function placeInitialItems(
  world: WorldDefinition,
  sessionId: string,
  holder: Exclude<Holder, { type: 'character' }>,
  reference: string,
  client?: QueryClientContract
): Promise<InventoryItem[]> {
  const placed: InventoryItem[] = []

  for (const definition of world.items) {
    if (
      definition.kind !== 'unique' ||
      definition.initialHolder === null ||
      definition.initialHolder.holder !== holder.type ||
      definition.initialHolder.reference !== reference
    ) {
      continue
    }

    const existing = await InventoryItem.query({ client })
      .where('sessionId', sessionId)
      .where('handle', definition.reference)
      .first()

    if (existing === null) {
      placed.push(
        await createItem(
          world,
          sessionId,
          { definition: definition.reference, descriptor: null, quantity: 1 },
          holder,
          client
        )
      )
    }
  }

  return placed
}

/**
 * Someone dies: what they held falls to the place where it happened, where
 * it can be picked up. A dead person is out of the scene, and their items
 * would otherwise be out of reach for good.
 */
export async function leaveItemsInPlace(
  world: WorldDefinition,
  npcInstanceId: string,
  locationInstanceId: string,
  client?: QueryClientContract
): Promise<void> {
  const items = await InventoryItem.query({ client })
    .where('npcInstanceId', npcInstanceId)
    .whereNot('state', 'gone')
    .orderBy('createdAt', 'asc')

  for (const item of items) {
    await transferItem(
      world,
      item,
      { type: 'location', id: locationInstanceId },
      item.quantity,
      client
    )
  }
}

/**
 * The items of the scene, grouped by holder, in the shape the turn context
 * carries. Gone ones stay out, and so does whatever is held out of the scene.
 */
export async function itemsInScene(
  sessionId: string,
  scene: { characterId: string; locationInstanceId: string | null },
  client?: QueryClientContract
): Promise<ItemsInScene> {
  const present = await NpcInstance.query({ client })
    .where('sessionId', sessionId)
    .where('status', 'present')
    .orderBy('createdAt', 'asc')
    .orderBy('handle', 'asc')
  const presentIds = present.map((npc) => npc.id)

  const items = await InventoryItem.query({ client })
    .where('sessionId', sessionId)
    .whereNot('state', 'gone')
    .where((query) => {
      query.where('characterId', scene.characterId)

      if (presentIds.length > 0) {
        query.orWhereIn('npcInstanceId', presentIds)
      }

      if (scene.locationInstanceId !== null) {
        query.orWhere('locationInstanceId', scene.locationInstanceId)
      }
    })
    .orderBy('createdAt', 'asc')
    /** Two items created in the same millisecond still come out in a stable order. */
    .orderBy('definitionReference', 'asc')
    .orderBy('handle', 'asc')

  return {
    character: items.filter((item) => item.characterId === scene.characterId).map(toHeldItem),
    npcs: present
      .map((npc) => ({
        handle: npc.handle,
        items: items.filter((item) => item.npcInstanceId === npc.id).map(toHeldItem),
      }))
      .filter((npc) => npc.items.length > 0),
    location: items
      .filter(
        (item) =>
          scene.locationInstanceId !== null && item.locationInstanceId === scene.locationInstanceId
      )
      .map(toHeldItem),
  }
}

function toHeldItem(item: InventoryItem): HeldItem {
  return {
    handle: item.handle,
    definition: item.definitionReference,
    descriptor: item.descriptor,
    quantity: item.quantity,
    equipped: item.state === 'equipped',
  }
}

function findDefinition(world: WorldDefinition, reference: string): ItemDefinition {
  const definition = world.items.find((item) => item.reference === reference)

  if (definition === undefined) {
    throw new UnknownItemError(world.reference, reference)
  }

  return definition
}

function isStackable(definition: ItemDefinition): boolean {
  return definition.kind === 'archetype' && definition.stackable
}

function checkQuantity(definition: ItemDefinition, quantity: number, item: string): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ItemRefusedError('invalid_quantity', item, `${quantity} is not a quantity.`)
  }

  if (quantity > 1 && !isStackable(definition)) {
    throw new ItemRefusedError('invalid_quantity', item, 'only a stack counts more than one.')
  }
}

function checkPresent(item: InventoryItem): void {
  if (item.state === 'gone') {
    throw new ItemRefusedError('gone', label(item), 'the item no longer exists.')
  }
}

/**
 * Removes part or all of an item; with nothing left, it is gone. A stack
 * emptied by a hand-over reads as gone too, and comes back on the next gain.
 */
async function takeAway(item: InventoryItem, quantity: number): Promise<void> {
  const left = item.quantity - quantity

  item.merge(left > 0 ? { quantity: left } : { quantity: 0, state: 'gone' })
  await item.save()
}

function holderColumns(holder: Holder) {
  return {
    characterId: holder.type === 'character' ? holder.id : null,
    npcInstanceId: holder.type === 'npc' ? holder.id : null,
    locationInstanceId: holder.type === 'location' ? holder.id : null,
  }
}

function isHeldBy(item: InventoryItem, holder: Holder): boolean {
  const columns = holderColumns(holder)

  return (
    item.characterId === columns.characterId &&
    item.npcInstanceId === columns.npcInstanceId &&
    item.locationInstanceId === columns.locationInstanceId
  )
}

async function findStack(
  sessionId: string,
  holder: Holder,
  definition: string,
  client?: QueryClientContract
): Promise<InventoryItem | null> {
  const column = {
    character: 'characterId',
    npc: 'npcInstanceId',
    location: 'locationInstanceId',
  }[holder.type]

  return InventoryItem.query({ client })
    .where('sessionId', sessionId)
    .where(column, holder.id)
    .where('definitionReference', definition)
    .whereNull('handle')
    .first()
}

async function countOf(
  sessionId: string,
  definition: string,
  client?: QueryClientContract
): Promise<number> {
  const row = await InventoryItem.query({ client })
    .where('sessionId', sessionId)
    .where('definitionReference', definition)
    .count('* as total')
    .firstOrFail()

  return Number(row.$extras.total)
}

/** How the error messages name an item: its handle, or its definition for a stack. */
function label(item: InventoryItem): string {
  return item.handle ?? item.definitionReference
}
