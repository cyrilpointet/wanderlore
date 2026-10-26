import vine from '@vinejs/vine'

import { CONTEXTUAL_EFFECTS, DIFFICULTIES } from '#services/rules/types'
import { MAX_CONTEXTUAL_MODIFIERS } from '#services/rules/engine'
import {
  DURATION_LABELS,
  MAX_DAYS,
  PERIODS,
  type Duration,
  type DurationLabel,
  type Period,
} from '#services/game/game_time'

import { NPC_DISPOSITIONS } from './world.js'
import { OUT_OF_CHARACTER } from './prompts/arbitration.js'
import type { SceneItem } from './inventory.js'
import type { ArbitrationOutput, ItemHolderRef, Movement, TurnEffects } from './prompts/types.js'

/**
 * Nothing coming out of the model is trusted.
 *
 * The gateway guarantees parsable JSON, never valid JSON: shape, bounds and —
 * above all — the existence of every identifier are checked here, before a
 * single field reaches the state. Whatever falls outside is rejected, not
 * applied.
 */

export type RejectionReason = {
  field: string
  rule: string
  message: string
  /** The values the field had to come from, when it is a closed list. */
  allowed?: string[]
}

export type ValidationStep = 'arbitration' | 'narration' | 'extraction'

/**
 * A backend validation failure, deliberately distinct from `LlmError`.
 *
 * The model answered, and answered parsable JSON — the transport worked. What
 * failed is our own rule, so it carries its own category all the way to the
 * player, as the project's error-handling decision requires.
 */
export class TurnValidationError extends Error {
  readonly step: ValidationStep
  readonly reasons: RejectionReason[]

  constructor(step: ValidationStep, reasons: RejectionReason[]) {
    super(`Turn ${step} output rejected: ${reasons.map((item) => item.message).join('; ')}`)
    this.name = 'TurnValidationError'
    this.step = step
    this.reasons = reasons
  }
}

export type ValidationMeta = {
  /** Closed list: the action types of the world, read from `resolution_rules`. */
  actionTypes: string[]
  /** Closed list: the handles of the people present, the only possible targets. */
  npcHandles: string[]
  /** Closed list: the named places the world defines, and so can label. */
  locations: string[]
  /** Closed list: the kinds of place an improvised one may be. */
  locationArchetypes: string[]
  /** Closed list: who may enter a scene — a named character or an archetype. */
  npcDefinitions: string[]
  /**
   * The items of the scene, by definition and by handle: none of them may
   * pass for a circumstance, or it would count twice.
   */
  itemsInScene: string[]
  /** The items of the scene extraction may move, destroy or equip, and who holds them. */
  sceneItems: SceneItem[]
  /** Closed list: the definitions an item may come into being from. */
  creatableItems: string[]
  /** What the rules of the inventory need to know of each definition. */
  itemKinds: ItemKind[]
  /** Whether the turn began somewhere: a place to drop things in, or pick them up from. */
  hasLocation: boolean
  /** Bounds the damage or healing a single turn may claim. */
  hitPointsMax: number
}

export type ItemKind = {
  reference: string
  unique: boolean
  stackable: boolean
  equippable: boolean
}

/**
 * Stable English reference, never a display name.
 *
 * A flag that arrives as "Queen's favour earned" would never match the one
 * written last turn, and the state would silently grow duplicates.
 */
const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

const MAX_FLAGS_PER_TURN = 5

/** More people moving in or out in a single narration means it is not reading the text. */
const MAX_NPC_CHANGES_PER_TURN = 6

/** More items changing in a single narration means it is not reading the text. */
const MAX_ITEM_CHANGES_PER_TURN = 6

/** A stack bought or found in one go — a purse of shot, a basket of food. */
const MAX_ITEM_QUANTITY = 50

const limitsOf = (field: { meta: unknown }) => field.meta as ValidationMeta

/** Flat on the wire: the handle only means something for someone present. */
const wireHolder = () =>
  vine.object({
    holder: vine.enum(['character', 'npc', 'location'] as const),
    handle: vine.string().trim().nullable(),
  })

const quantity = () => vine.number().withoutDecimals().min(1).max(MAX_ITEM_QUANTITY)

const presentHandle = () => vine.enum((field) => limitsOf(field).npcHandles)

const shortText = (length: number) => vine.string().trim().minLength(1).maxLength(length)

const arbitrationValidator = vine.withMetaData<ValidationMeta>().create({
  intent: vine.object({
    type: vine.string().regex(REFERENCE),
    /** Someone present, by handle — never a name the backend could not resolve. */
    target: vine.enum((field) => (field.meta as ValidationMeta).npcHandles).nullable(),
    summary: vine.string().maxLength(500),
  }),
  validity: vine.object({
    factual: vine.boolean(),
    plausibility: vine.enum(['plausible', 'borderline', 'impossible'] as const),
    justification: vine.string().maxLength(500),
  }),
  resolution: vine.object({
    mode: vine.enum(['automatic_success', 'narrative_automatic_failure', 'roll_required'] as const),
    /**
     * The closed list the rules document demands: a category of the world,
     * never a skill and never one it invented. The backend derives the skill.
     */
    action_type: vine.enum((field) => (field.meta as ValidationMeta).actionTypes).nullable(),
    difficulty: vine.enum(DIFFICULTIES).nullable(),
    /**
     * Labels, never values; three at most. Optional on the wire: a model that
     * leaves it out saw no circumstance worth one.
     */
    contextual_modifiers: vine
      .array(
        vine.object({
          source: vine.string().regex(REFERENCE),
          effect: vine.enum(CONTEXTUAL_EFFECTS),
        })
      )
      .maxLength(MAX_CONTEXTUAL_MODIFIERS)
      .optional(),
  }),
  /**
   * A label of the scale, never a time: a number of days within a week, or a
   * period of the day to wait for. Whether each goes with its label is
   * checked below.
   */
  duration: vine.object({
    label: vine.enum(DURATION_LABELS),
    count: vine.number().withoutDecimals().min(1).max(MAX_DAYS).nullable(),
    period: vine.enum(PERIODS).nullable(),
  }),
  alert: vine.object({
    prompt_injection_suspected: vine.boolean(),
    out_of_scope: vine.boolean(),
  }),
})

const extractionValidator = vine.withMetaData<ValidationMeta>().create({
  /**
   * Flat on the wire, so any provider can describe it: a named place in
   * `location`, or an archetype in `definition` set in a named `parent`. A
   * place the model made up would reach the player with no label to show.
   */
  movement: vine
    .object({
      location: vine.enum((field) => limitsOf(field).locations).nullable(),
      definition: vine.enum((field) => limitsOf(field).locationArchetypes).nullable(),
      parent: vine.enum((field) => limitsOf(field).locations).nullable(),
      descriptor: shortText(200).nullable(),
      name: shortText(64).nullable(),
    })
    .nullable(),
  npcs_entered: vine
    .array(
      vine.object({
        definition: vine.enum((field) => limitsOf(field).npcDefinitions),
        descriptor: shortText(200).nullable(),
        /** Optional on the wire: an entry with no name is a nameless one. */
        name: shortText(64).nullable().optional(),
      })
    )
    .maxLength(MAX_NPC_CHANGES_PER_TURN),
  /** Only someone present can leave, follow, give a name or change attitude. */
  npcs_left: vine.array(presentHandle()).maxLength(MAX_NPC_CHANGES_PER_TURN),
  npcs_following: vine.array(presentHandle()).maxLength(MAX_NPC_CHANGES_PER_TURN),
  npc_names: vine
    .array(vine.object({ handle: presentHandle(), name: shortText(64) }))
    .maxLength(MAX_NPC_CHANGES_PER_TURN),
  /** A qualitative label, never a score nor a step. */
  npc_relations: vine
    .array(vine.object({ handle: presentHandle(), disposition: vine.enum(NPC_DISPOSITIONS) }))
    .maxLength(MAX_NPC_CHANGES_PER_TURN),
  scenario_flags: vine.array(vine.string().regex(REFERENCE)).maxLength(MAX_FLAGS_PER_TURN),
  hit_points_delta: vine.number().withoutDecimals(),
  /** Only from the closed list: an item the model invented would have no effect and no label. */
  items_created: vine
    .array(
      vine.object({
        definition: vine.enum((field) => limitsOf(field).creatableItems),
        descriptor: shortText(200).nullable(),
        quantity: quantity(),
        holder: wireHolder(),
        equipped: vine.boolean(),
      })
    )
    .maxLength(MAX_ITEM_CHANGES_PER_TURN),
  items_transferred: vine
    .array(
      vine.object({
        item: vine.string().trim(),
        from: wireHolder(),
        to: wireHolder(),
        quantity: quantity(),
      })
    )
    .maxLength(MAX_ITEM_CHANGES_PER_TURN),
  items_destroyed: vine
    .array(vine.object({ item: vine.string().trim(), holder: wireHolder(), quantity: quantity() }))
    .maxLength(MAX_ITEM_CHANGES_PER_TURN),
  items_equipped: vine.array(vine.string().trim()).maxLength(MAX_ITEM_CHANGES_PER_TURN),
  items_unequipped: vine.array(vine.string().trim()).maxLength(MAX_ITEM_CHANGES_PER_TURN),
})

export async function validateArbitration(
  payload: unknown,
  meta: ValidationMeta
): Promise<ArbitrationOutput> {
  const output = await run<RawArbitration>('arbitration', arbitrationValidator, payload, meta)
  const modifiers = output.resolution.contextual_modifiers ?? []

  const reasons = [
    ...coherenceReasons(output),
    ...modifierReasons(modifiers, meta),
    ...durationReasons(output.duration),
  ]

  if (reasons.length > 0) {
    throw new TurnValidationError('arbitration', reasons)
  }

  return {
    ...output,
    duration: toDuration(output.duration),
    resolution: {
      ...output.resolution,
      /**
       * No roll, nothing to modify: circumstances sent with a settled outcome
       * are dropped rather than refused, which would only cost a second call.
       */
      contextual_modifiers: output.resolution.mode === 'roll_required' ? modifiers : [],
    },
  }
}

type RawArbitration = Omit<ArbitrationOutput, 'resolution' | 'duration'> & {
  resolution: Omit<ArbitrationOutput['resolution'], 'contextual_modifiers'> & {
    contextual_modifiers?: ArbitrationOutput['resolution']['contextual_modifiers']
  }
  duration: FlatDuration
}

/** The duration as it travels: every field present, count and period mostly null. */
type FlatDuration = {
  label: DurationLabel
  count: number | null
  period: Period | null
}

/**
 * Days need their count, a wait needs its period. A count or a period sent
 * with a label that has none is dropped rather than refused: it changes
 * nothing, and refusing it would only cost a second call.
 */
function durationReasons(duration: FlatDuration): RejectionReason[] {
  if (duration.label === 'days' && duration.count === null) {
    return [reason('duration.count', 'required', `Days need their count, from 1 to ${MAX_DAYS}.`)]
  }

  if (duration.label === 'until' && duration.period === null) {
    return [reason('duration.period', 'required', 'A wait needs the period of the day it ends at.')]
  }

  return []
}

function toDuration(duration: FlatDuration): Duration {
  switch (duration.label) {
    case 'days':
      return { label: 'days', count: duration.count! }
    case 'until':
      return { label: 'until', period: duration.period! }
    default:
      return { label: duration.label }
  }
}

/**
 * An item passed off as a circumstance would be counted twice — once by the
 * backend from the inventory, once as the model priced it.
 */
function modifierReasons(
  modifiers: ArbitrationOutput['resolution']['contextual_modifiers'],
  meta: ValidationMeta
): RejectionReason[] {
  return modifiers
    .filter(({ source }) => meta.itemsInScene.includes(source))
    .map(({ source }) =>
      reason(
        'resolution.contextual_modifiers',
        'item',
        `"${source}" is an item: items are counted by the backend, never as a circumstance.`
      )
    )
}

export async function validateExtraction(
  payload: unknown,
  meta: ValidationMeta
): Promise<TurnEffects> {
  const output = await run<RawExtraction>('extraction', extractionValidator, payload, meta)
  const items = readItems(output, meta)

  const reasons = [
    ...movementReasons(output.movement),
    ...effectReasons(output, meta),
    ...items.reasons,
  ]

  if (reasons.length > 0) {
    throw new TurnValidationError('extraction', reasons)
  }

  return {
    ...output,
    ...items.effects,
    movement: toMovement(output.movement),
    npcs_entered: output.npcs_entered.map((entry) => ({ ...entry, name: entry.name ?? null })),
  }
}

/** The movement as it travels: every field present, most of them null. */
type FlatMovement = {
  location: string | null
  definition: string | null
  parent: string | null
  descriptor: string | null
  name: string | null
}

type WireHolder = { holder: 'character' | 'npc' | 'location'; handle: string | null }

type ItemFields =
  'items_created' | 'items_transferred' | 'items_destroyed' | 'items_equipped' | 'items_unequipped'

type RawExtraction = Omit<TurnEffects, 'movement' | 'npcs_entered' | ItemFields> & {
  movement: FlatMovement | null
  npcs_entered: { definition: string; descriptor: string | null; name?: string | null }[]
  items_created: (Omit<TurnEffects['items_created'][number], 'holder'> & {
    holder: WireHolder
  })[]
  items_transferred: { item: string; from: WireHolder; to: WireHolder; quantity: number }[]
  items_destroyed: { item: string; holder: WireHolder; quantity: number }[]
  items_equipped: string[]
  items_unequipped: string[]
}

/**
 * Item changes checked against the scene as the turn began: every item named
 * is held by the holder named, never more of it moves or goes than there is,
 * a copy changes once at most, and only the character equips what can be
 * equipped. Holders come back as references the backend can resolve.
 */
function readItems(
  output: RawExtraction,
  meta: ValidationMeta
): { reasons: RejectionReason[]; effects: Pick<TurnEffects, ItemFields> } {
  const reasons: RejectionReason[] = []
  const kindOf = (definition: string) =>
    meta.itemKinds.find((kind) => kind.reference === definition)

  const holderOf = (wire: WireHolder, field: string): ItemHolderRef | null => {
    if (wire.holder === 'character') {
      return { holder: 'character' }
    }

    if (wire.holder === 'location') {
      if (meta.hasLocation) {
        return { holder: 'location' }
      }

      reasons.push(
        reason(field, 'location', 'The scene began nowhere: there is no place to hold it.')
      )
      return null
    }

    if (wire.handle !== null && meta.npcHandles.includes(wire.handle)) {
      return { holder: 'npc', handle: wire.handle }
    }

    reasons.push({
      ...reason(field, 'enum', `"${wire.handle}" is not someone present.`),
      allowed: meta.npcHandles,
    })
    return null
  }

  /** The item a holder has, as the scene began; refused when they have no such thing. */
  const heldBy = (item: string, holder: ItemHolderRef | null, field: string) => {
    if (holder === null) {
      return null
    }

    const held = meta.sceneItems.filter((entry) => sameHolder(entry.holder, holder))
    const found = held.find((entry) => entry.item === item)

    if (found === undefined) {
      reasons.push({
        ...reason(field, 'enum', `"${item}" is not held by ${describe(holder)}.`),
        allowed: held.map((entry) => entry.item),
      })
    }

    return found ?? null
  }

  const checkCount = (definition: string, count: number, field: string) => {
    if (count > 1 && !kindOf(definition)?.stackable) {
      reasons.push(reason(field, 'quantity', `"${definition}" counts by copy: one at a time.`))
    }
  }

  const created = output.items_created.flatMap((entry, index) => {
    const field = `items_created.${index}`
    const holder = holderOf(entry.holder, `${field}.holder`)
    const kind = kindOf(entry.definition)

    checkCount(entry.definition, entry.quantity, `${field}.quantity`)

    if (entry.equipped && (holder?.holder !== 'character' || !kind?.equippable)) {
      reasons.push(
        reason(`${field}.equipped`, 'equip', 'Only the character equips, and only what can be.')
      )
    }

    if (
      kind?.unique &&
      output.items_created.findIndex((other) => other.definition === entry.definition) !== index
    ) {
      reasons.push(reason(field, 'unique', `"${entry.definition}" exists once.`))
    }

    return holder === null ? [] : [{ ...entry, holder }]
  })

  /** How much of each item each holder gives away or uses up, against what they hold. */
  const outflow = new Map<SceneItem, number>()
  const changedCopies = new Set<string>()
  const track = (held: SceneItem | null, count: number, field: string) => {
    if (held === null) {
      return
    }

    checkCount(held.definition, count, `${field}.quantity`)
    outflow.set(held, (outflow.get(held) ?? 0) + count)

    if (!kindOf(held.definition)?.stackable) {
      if (changedCopies.has(held.item)) {
        reasons.push(reason(field, 'conflict', `"${held.item}" changes only once in a turn.`))
      }
      changedCopies.add(held.item)
    }
  }

  const transferred = output.items_transferred.flatMap((entry, index) => {
    const field = `items_transferred.${index}`
    const from = holderOf(entry.from, `${field}.from`)
    const to = holderOf(entry.to, `${field}.to`)

    if (from !== null && to !== null && sameHolder(from, to)) {
      reasons.push(reason(field, 'conflict', 'An item cannot be handed to whoever holds it.'))
    }

    track(heldBy(entry.item, from, `${field}.item`), entry.quantity, field)

    return from === null || to === null ? [] : [{ ...entry, from, to }]
  })

  const destroyed = output.items_destroyed.flatMap((entry, index) => {
    const field = `items_destroyed.${index}`
    const holder = holderOf(entry.holder, `${field}.holder`)

    track(heldBy(entry.item, holder, `${field}.item`), entry.quantity, field)

    return holder === null ? [] : [{ ...entry, holder }]
  })

  for (const [held, count] of outflow) {
    if (count > held.quantity) {
      reasons.push(
        reason(
          'items',
          'quantity',
          `${count} of "${held.item}" cannot leave ${describe(held.holder)}, who has ${held.quantity}.`
        )
      )
    }
  }

  /** The copies the character holds once the hand-overs are done, and that still exist. */
  const characterCopies = new Set(
    [
      ...meta.sceneItems
        .filter((entry) => entry.holder.holder === 'character')
        .map(({ item }) => item),
      ...transferred.filter(({ to }) => to.holder === 'character').map(({ item }) => item),
    ].filter(
      (item) =>
        !transferred.some((entry) => entry.item === item && entry.to.holder !== 'character') &&
        !destroyed.some((entry) => entry.item === item)
    )
  )

  const equipping = (list: string[], name: 'items_equipped' | 'items_unequipped') =>
    list.filter((item, index) => {
      const definition = meta.sceneItems.find((entry) => entry.item === item)?.definition
      const kind = definition === undefined ? undefined : kindOf(definition)

      if (!characterCopies.has(item) || kind?.stackable || !kind?.equippable) {
        reasons.push({
          ...reason(`${name}.${index}`, 'equip', `"${item}" is no copy the character can equip.`),
          allowed: [...characterCopies],
        })
        return false
      }

      return true
    })

  const equipped = equipping(output.items_equipped, 'items_equipped')
  const unequipped = equipping(output.items_unequipped, 'items_unequipped')

  for (const item of equipped.filter((entry) => unequipped.includes(entry))) {
    reasons.push(reason('items_unequipped', 'conflict', `"${item}" cannot be drawn and put away.`))
  }

  return {
    reasons,
    effects: {
      items_created: created,
      items_transferred: transferred,
      items_destroyed: destroyed,
      items_equipped: equipped,
      items_unequipped: unequipped,
    },
  }
}

function sameHolder(a: ItemHolderRef, b: ItemHolderRef): boolean {
  return (
    a.holder === b.holder && (a.holder !== 'npc' || (b.holder === 'npc' && a.handle === b.handle))
  )
}

function describe(holder: ItemHolderRef): string {
  return holder.holder === 'npc' ? `"${holder.handle}"` : `the ${holder.holder}`
}

/**
 * Every field null, sent where `null` was meant: no movement. Refusing it
 * would push a second attempt into inventing one.
 */
function isEmpty(movement: FlatMovement | null): boolean {
  return (
    movement === null ||
    (movement.location === null && movement.definition === null && movement.parent === null)
  )
}

/**
 * Exactly one of the two forms: a named place, or an archetype within a named
 * place. Anything in between could not be placed on the map.
 */
function movementReasons(movement: FlatMovement | null): RejectionReason[] {
  if (movement === null || isEmpty(movement)) {
    return []
  }

  if (movement.location !== null) {
    return movement.definition !== null || movement.parent !== null
      ? [
          reason(
            'movement',
            'ambiguous',
            'A movement goes either to a named location or to a new place of an archetype, not both.'
          ),
        ]
      : []
  }

  if (movement.definition === null) {
    return [
      reason('movement', 'required', 'A movement needs a location, or a definition and a parent.'),
    ]
  }

  return movement.parent === null
    ? [reason('movement.parent', 'required', 'A new place must sit within a named location.')]
    : []
}

/**
 * A named place carries nothing else: its label and parent are the world's. A
 * descriptor or a name sent along with it is dropped rather than refused.
 */
function toMovement(movement: FlatMovement | null): Movement | null {
  if (movement === null || isEmpty(movement)) {
    return null
  }

  if (movement.location !== null) {
    return { location: movement.location }
  }

  return {
    definition: movement.definition!,
    parent: movement.parent!,
    descriptor: movement.descriptor,
    name: movement.name,
  }
}

/**
 * Cross-field coherence, which no per-field schema can express: a roll needs
 * a category and a difficulty, and an outcome settled without one has neither.
 */
function coherenceReasons(output: {
  intent: { type: string; target: string | null }
  resolution: { mode: string; action_type: string | null; difficulty: string | null }
}): RejectionReason[] {
  const { mode, action_type: actionType, difficulty } = output.resolution

  /** An aside to the game master is no action: nothing to roll, nobody targeted. */
  if (output.intent.type === OUT_OF_CHARACTER && mode !== 'automatic_success') {
    return [
      reason('resolution.mode', 'aside', 'An aside to the game master is an automatic success.'),
    ]
  }

  if (mode === 'roll_required') {
    return [
      ...(actionType === null
        ? [reason('resolution.action_type', 'required', 'A roll needs an action type.')]
        : []),
      ...(difficulty === null
        ? [reason('resolution.difficulty', 'required', 'A roll needs a difficulty to beat.')]
        : []),
    ]
  }

  return [
    ...(actionType !== null
      ? [reason('resolution.action_type', 'forbidden', 'No roll, so no action type applies.')]
      : []),
    ...(difficulty !== null
      ? [reason('resolution.difficulty', 'forbidden', 'No roll, so no difficulty applies.')]
      : []),
  ]
}

/**
 * Bounds that depend on the character, so they cannot live in the schema.
 */
function effectReasons(
  effect: Pick<TurnEffects, 'hit_points_delta' | 'npcs_left' | 'npcs_following'>,
  limits: ValidationMeta
): RejectionReason[] {
  const reasons: RejectionReason[] = []

  if (Math.abs(effect.hit_points_delta) > limits.hitPointsMax) {
    reasons.push(
      reason(
        'hit_points_delta',
        'range',
        `A single turn cannot move hit points by more than ${limits.hitPointsMax}.`
      )
    )
  }

  /** Leaving the scene and following the character out of it cannot both be true. */
  for (const handle of effect.npcs_following.filter((item) => effect.npcs_left.includes(item))) {
    reasons.push(reason('npcs_following', 'conflict', `"${handle}" cannot both leave and follow.`))
  }

  return reasons
}

async function run<TOutput>(
  step: ValidationStep,
  validator: { tryValidate: (data: unknown, options: { meta: ValidationMeta }) => Promise<any> },
  payload: unknown,
  meta: ValidationMeta
): Promise<TOutput> {
  const [error, output] = await validator.tryValidate(payload, { meta })

  if (error) {
    throw new TurnValidationError(step, toReasons(error))
  }

  return output as TOutput
}

function toReasons(error: unknown): RejectionReason[] {
  const messages = (error as { messages?: unknown }).messages

  if (!Array.isArray(messages)) {
    return [reason('*', 'invalid', (error as Error).message)]
  }

  return messages.map(
    (entry: { field?: string; rule?: string; message?: string; meta?: { choices?: unknown } }) => {
      const rejected = reason(
        entry.field ?? '*',
        entry.rule ?? 'invalid',
        entry.message ?? 'Rejected.'
      )
      const choices = entry.meta?.choices

      /** A closed list names its valid values, so a second attempt can pick one. */
      return Array.isArray(choices) ? { ...rejected, allowed: choices.map(String) } : rejected
    }
  )
}

function reason(field: string, rule: string, message: string): RejectionReason {
  return { field, rule, message }
}
