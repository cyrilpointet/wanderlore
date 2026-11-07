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
import { FIRST_AID, isCombatActionType } from './system_references.js'
import type { SceneItem } from './inventory.js'
import type {
  ArbitrationOutput,
  CombatEngagement,
  ItemHolderRef,
  Movement,
  TurnEffects,
} from './prompts/types.js'

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
  /** Closed list: the places the exits of a network reach, where a movement may be timed to. */
  reachableLocations: string[]
  /**
   * Closed list: the named places a movement may reach from where the scene
   * began — the exits of a network once those it finds or opens are, or the
   * places travelled to freely — and the place itself.
   */
  locations: string[]
  /** Closed list: the kinds of place an improvised one may be; none inside a network. */
  locationArchetypes: string[]
  /** Closed list: the named places an improvised one may sit in. */
  parentLocations: string[]
  /** Closed lists: the hidden exits of the place not found yet, and its locked ones, by where they lead. */
  hiddenExits: string[]
  lockedExits: string[]
  /**
   * The named places a movement may reach once the exits found and opened
   * this turn are, by where they lead: a way through a hidden or locked exit
   * the narration did not open is no way.
   */
  destinationsAfter: (opened: { discovered: string[]; unlocked: string[] }) => string[]
  /** Closed list: who may enter a scene — a named character or an archetype. */
  npcDefinitions: string[]
  /**
   * Closed list: the archetypes of the world, which the character may attack
   * before anyone wrote them in — the backend brings them in for the round.
   */
  npcArchetypes: string[]
  /**
   * The items of the scene, by definition and by handle: none of them may
   * pass for a circumstance, or it would count twice.
   */
  itemsInScene: string[]
  /** The items of the scene extraction may move, destroy or equip, and who holds them. */
  sceneItems: SceneItem[]
  /**
   * Closed list: the items hidden in the place the scene began in, by handle —
   * to be found before they are taken, moved or destroyed.
   */
  hiddenItems: string[]
  /** Closed list: the definitions an item may come into being from. */
  creatableItems: string[]
  /** What the rules of the inventory need to know of each definition. */
  itemKinds: ItemKind[]
  /** Whether the turn began somewhere: a place to drop things in, or pick them up from. */
  hasLocation: boolean
  /** Bounds the damage or healing a single turn may claim. */
  hitPointsMax: number
  /** Closed list: the scenario's flags, the only ones extraction may set. */
  flags: string[]
  /** Closed list: the events the character knows are coming, which they may wait for. */
  foreseeableEvents: string[]
  /** Closed list: the unique people the character knows whose schedule may bring them here. */
  awaitableNpcs: string[]
}

export type ItemKind = {
  reference: string
  unique: boolean
  stackable: boolean
  equippable: boolean
}

/** Stable English reference, never a display name. */
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
    /** Checked against the places the exits reach, below. Optional on the wire: no movement. */
    destination: vine.string().trim().nullable().optional(),
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
    /** Checked against what the character may wait for, below. Optional on the wire: no wait. */
    event: vine.string().trim().nullable().optional(),
    npc: vine.string().trim().nullable().optional(),
  }),
  /**
   * Flat on the wire, so any provider can describe it: no opponent is no
   * round of combat. Optional on the wire: a model that leaves it out saw
   * no fight. Who the opponent may be is checked below.
   */
  combat: vine
    .object({
      opponent: vine.string().trim().regex(REFERENCE).nullable(),
      character_attacks: vine.boolean(),
      parry_possible: vine.boolean(),
      dodge_possible: vine.boolean(),
      defense_modifiers: vine
        .array(
          vine.object({
            source: vine.string().regex(REFERENCE),
            effect: vine.enum(CONTEXTUAL_EFFECTS),
          })
        )
        .maxLength(MAX_CONTEXTUAL_MODIFIERS)
        .optional(),
      opponent_aware: vine.boolean(),
      riposte_possible: vine.boolean(),
      opponent_defense_modifiers: vine
        .array(
          vine.object({
            source: vine.string().regex(REFERENCE),
            effect: vine.enum(CONTEXTUAL_EFFECTS),
          })
        )
        .maxLength(MAX_CONTEXTUAL_MODIFIERS)
        .optional(),
    })
    .optional(),
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
      parent: vine.enum((field) => limitsOf(field).parentLocations).nullable(),
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
  /**
   * From the scenario's closed list: a flag that arrives as "Queen's favour
   * earned", or as one nothing declared, would never set off an event.
   */
  scenario_flags: vine
    .array(vine.enum((field) => limitsOf(field).flags))
    .distinct()
    .maxLength(MAX_FLAGS_PER_TURN),
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
  /** Exits of the place the scene began in, by where they lead. Optional on the wire: none. */
  passages_discovered: vine
    .array(vine.enum((field) => limitsOf(field).hiddenExits))
    .distinct()
    .optional(),
  passages_unlocked: vine
    .array(vine.enum((field) => limitsOf(field).lockedExits))
    .distinct()
    .optional(),
  /** Hidden items of the place the scene began in, by handle. Optional on the wire: none. */
  items_discovered: vine
    .array(vine.enum((field) => limitsOf(field).hiddenItems))
    .distinct()
    .optional(),
})

export async function validateArbitration(
  payload: unknown,
  meta: ValidationMeta
): Promise<ArbitrationOutput> {
  const output = await run<RawArbitration>('arbitration', arbitrationValidator, payload, meta)
  const modifiers = output.resolution.contextual_modifiers ?? []

  const destination = destinationOf(output, meta)
  const combat = combatOf(output, meta)
  const reasons = [
    ...coherenceReasons(output),
    ...modifierReasons(modifiers, meta),
    ...durationReasons(output.duration, meta),
    ...destination.reasons,
    ...combat.reasons,
  ]

  if (reasons.length > 0) {
    throw new TurnValidationError('arbitration', reasons)
  }

  return {
    ...output,
    intent: { ...output.intent, destination: destination.value },
    duration: toDuration(output.duration),
    combat: combat.value,
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

/**
 * A destination outside a network times nothing, so it is dropped rather than
 * refused, and so is an aside's; within one, it comes from the places the
 * exits reach, or the turn would be timed on a way that does not exist.
 */
function destinationOf(
  output: RawArbitration,
  meta: ValidationMeta
): { value: string | null; reasons: RejectionReason[] } {
  const destination = output.intent.destination ?? null

  if (
    destination === null ||
    meta.reachableLocations.length === 0 ||
    output.intent.type === OUT_OF_CHARACTER
  ) {
    return { value: null, reasons: [] }
  }

  if (!meta.reachableLocations.includes(destination)) {
    return {
      value: null,
      reasons: [
        {
          ...reason(
            'intent.destination',
            'enum',
            `"${destination}" cannot be reached from here by the exits.`
          ),
          allowed: meta.reachableLocations,
        },
      ],
    }
  }

  return { value: destination, reasons: [] }
}

/** The engagement as it travels: always an object, its opponent null when there is no fight. */
type FlatCombat = Omit<
  CombatEngagement,
  'opponent' | 'defense_modifiers' | 'opponent_defense_modifiers'
> & {
  opponent: string | null
  defense_modifiers?: CombatEngagement['defense_modifiers']
  opponent_defense_modifiers?: CombatEngagement['opponent_defense_modifiers']
}

/**
 * A round of combat is against someone present — or, attacked first, an
 * archetype the backend brings in. The character's attack is a roll on one
 * of the two attacking categories; first aid is never given in the thick of
 * a fight. Only the character's blow can catch the opponent unaware, and a
 * round where the character neither strikes nor can be struck holds nothing.
 * An aside fights no one: whatever is sent with it is dropped.
 */
function combatOf(
  output: RawArbitration,
  meta: ValidationMeta
): { value: CombatEngagement | null; reasons: RejectionReason[] } {
  const combat = output.combat

  if (combat === undefined || combat.opponent === null || output.intent.type === OUT_OF_CHARACTER) {
    return { value: null, reasons: [] }
  }

  const reasons: RejectionReason[] = []
  const { opponent } = combat
  const archetype = meta.npcArchetypes.includes(opponent) && !meta.npcHandles.includes(opponent)

  if (!meta.npcHandles.includes(opponent) && !(archetype && combat.character_attacks)) {
    reasons.push({
      ...reason(
        'combat.opponent',
        'enum',
        combat.character_attacks
          ? `"${opponent}" is neither someone present nor a kind of person of this world.`
          : `"${opponent}" is not someone present: only they can attack the character.`
      ),
      allowed: combat.character_attacks
        ? [...meta.npcHandles, ...meta.npcArchetypes]
        : meta.npcHandles,
    })
  }

  const { mode, action_type: actionType } = output.resolution

  if (combat.character_attacks && (mode !== 'roll_required' || !isCombatActionType(actionType))) {
    reasons.push(
      reason(
        'resolution.action_type',
        'attack',
        'An attack on the opponent is a roll on melee_combat or ranged_combat.'
      )
    )
  }

  if (actionType === FIRST_AID) {
    reasons.push(
      reason(
        'resolution.action_type',
        'first_aid_in_combat',
        'First aid cannot be given in the thick of a fight: leave combat.opponent null, or pick another action.'
      )
    )
  }

  if (!combat.character_attacks && !combat.opponent_aware) {
    reasons.push(
      reason(
        'combat.opponent_aware',
        'unaware_without_attack',
        'Only the character’s own blow can catch the opponent unaware: set opponent_aware to true when the character does not attack.'
      )
    )
  }

  if (!combat.character_attacks && !combat.riposte_possible) {
    reasons.push(
      reason(
        'combat.riposte_possible',
        'empty_round',
        'A round where the character does not attack and the opponent cannot reach them is no round: leave combat.opponent null.'
      )
    )
  }

  const defenseModifiers = combat.defense_modifiers ?? []
  const opponentDefenseModifiers = combat.opponent_defense_modifiers ?? []
  for (const [field, modifiers] of [
    ['combat.defense_modifiers', defenseModifiers],
    ['combat.opponent_defense_modifiers', opponentDefenseModifiers],
  ] as const) {
    reasons.push(...modifierReasons(modifiers, meta).map((item) => ({ ...item, field })))
  }

  return {
    value: {
      opponent,
      character_attacks: combat.character_attacks,
      parry_possible: combat.parry_possible,
      dodge_possible: combat.dodge_possible,
      defense_modifiers: defenseModifiers,
      opponent_aware: combat.opponent_aware,
      riposte_possible: combat.riposte_possible,
      opponent_defense_modifiers: opponentDefenseModifiers,
    },
    reasons,
  }
}

type RawArbitration = Omit<ArbitrationOutput, 'resolution' | 'duration' | 'intent' | 'combat'> & {
  combat?: FlatCombat
  intent: Omit<ArbitrationOutput['intent'], 'destination'> & { destination?: string | null }
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
  event?: string | null
  npc?: string | null
}

/**
 * Days need their count, a wait needs its period — or what it waits for, from
 * the closed lists of what the character knows is coming. A field sent with a
 * label that has none is dropped rather than refused: it changes nothing, and
 * refusing it would only cost a second call.
 */
function durationReasons(duration: FlatDuration, meta: ValidationMeta): RejectionReason[] {
  if (duration.label === 'days' && duration.count === null) {
    return [reason('duration.count', 'required', `Days need their count, from 1 to ${MAX_DAYS}.`)]
  }

  if (duration.label === 'until' && duration.period === null) {
    return [reason('duration.period', 'required', 'A wait needs the period of the day it ends at.')]
  }

  if (duration.label === 'until_event' && !meta.foreseeableEvents.includes(duration.event ?? '')) {
    return [
      {
        ...reason(
          'duration.event',
          'enum',
          'A wait for an event names one the character knows is coming.'
        ),
        allowed: meta.foreseeableEvents,
      },
    ]
  }

  if (duration.label === 'until_npc' && !meta.awaitableNpcs.includes(duration.npc ?? '')) {
    return [
      {
        ...reason(
          'duration.npc',
          'enum',
          'A wait for someone names a person the character knows, whose comings and goings bring them here.'
        ),
        allowed: meta.awaitableNpcs,
      },
    ]
  }

  return []
}

function toDuration(duration: FlatDuration): Duration {
  switch (duration.label) {
    case 'days':
      return { label: 'days', count: duration.count! }
    case 'until':
      return { label: 'until', period: duration.period! }
    case 'until_event':
      return { label: 'until_event', event: duration.event! }
    case 'until_npc':
      return { label: 'until_npc', npc: duration.npc! }
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

  const passages = {
    discovered: output.passages_discovered ?? [],
    unlocked: output.passages_unlocked ?? [],
  }
  const discovered = output.items_discovered ?? []
  const reasons = [
    ...movementReasons(output.movement),
    ...wayReasons(output.movement, passages, meta),
    ...effectReasons(output, meta),
    ...hiddenItemReasons(output, discovered, meta),
    ...items.reasons,
  ]

  if (reasons.length > 0) {
    throw new TurnValidationError('extraction', reasons)
  }

  return {
    ...output,
    ...items.effects,
    passages_discovered: passages.discovered,
    passages_unlocked: passages.unlocked,
    items_discovered: discovered,
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

/**
 * A named place reached by the exits only once the way there is open: the
 * hidden exit found, the locked one opened, in this narration or before.
 */
function wayReasons(
  movement: FlatMovement | null,
  passages: { discovered: string[]; unlocked: string[] },
  meta: ValidationMeta
): RejectionReason[] {
  const destination = movement?.location ?? null

  if (destination === null || meta.destinationsAfter(passages).includes(destination)) {
    return []
  }

  return [
    reason(
      'movement.location',
      'closed_way',
      `The way to "${destination}" is hidden or locked: it has to be found or opened first.`
    ),
  ]
}

/**
 * A hidden item is taken, moved or destroyed only once found — in this
 * narration or before — as a hidden exit is gone through.
 */
function hiddenItemReasons(
  output: Pick<RawExtraction, 'items_transferred' | 'items_destroyed'>,
  discovered: string[],
  meta: ValidationMeta
): RejectionReason[] {
  const unseen = (item: string) => meta.hiddenItems.includes(item) && !discovered.includes(item)
  const refuse = (field: string, item: string) =>
    reason(
      field,
      'hidden_item',
      `"${item}" lies hidden: it has to be found first, in items_discovered.`
    )

  return [
    ...output.items_transferred.flatMap((entry, index) =>
      entry.from.holder === 'location' && unseen(entry.item)
        ? [refuse(`items_transferred.${index}.item`, entry.item)]
        : []
    ),
    ...output.items_destroyed.flatMap((entry, index) =>
      entry.holder.holder === 'location' && unseen(entry.item)
        ? [refuse(`items_destroyed.${index}.item`, entry.item)]
        : []
    ),
  ]
}

type RawExtraction = Omit<
  TurnEffects,
  | 'movement'
  | 'npcs_entered'
  | 'passages_discovered'
  | 'passages_unlocked'
  | 'items_discovered'
  | ItemFields
> & {
  passages_discovered?: string[]
  passages_unlocked?: string[]
  items_discovered?: string[]
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

  /** Healing is the backend's own, by first aid and by time: extraction only reads harm. */
  if (effect.hit_points_delta > 0) {
    reasons.push(
      reason(
        'hit_points_delta',
        'healing',
        'Healing is worked out by the game: hit_points_delta is 0, or negative for harm.'
      )
    )
  }

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
