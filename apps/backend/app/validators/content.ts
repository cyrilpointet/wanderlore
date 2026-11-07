import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

import {
  CHARACTERISTICS,
  DAMAGE_MODIFIER_USES,
  DEFINITION_KINDS,
  EVENT_CONDITION_TYPES,
  EVENT_EFFECT_TYPES,
  GAME_OUTCOMES,
  ITEM_CONDITIONS,
  LORE_FRAGMENT_KINDS,
  NPC_DISPOSITIONS,
  POWER_LEVELS,
  SKILL_CATEGORIES,
  SPECIAL_EFFECTS,
  WEAPON_KINDS,
} from '#services/game/content/types'
import { isDiceExpression, maximumOf, parseDice } from '#services/rules/dice_expression'
import { FIXED_DURATIONS, MAX_DAYS, PERIODS } from '#services/game/game_time'

/**
 * The game content the back-office writes. Everything a turn later reads is
 * checked here, field by field: a game master's typo is refused with the
 * field at fault, never stored to break a game afterwards.
 *
 * Nested structures — combat profiles, item modifiers, starting equipment,
 * the initial state — arrive as JSON written by hand: they get the
 * same treatment, with the path of the faulty field.
 *
 * Whether the content holds together as a whole (a category of action naming
 * a skill that exists…) is checked at publication, not here.
 */

/** A stable English reference: what the code, the state and the model use. */
export const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

const reference = () => vine.string().trim().regex(REFERENCE)

const sentence = (max = 1000) => vine.string().trim().minLength(1).maxLength(max)

/** Every name, in whatever language, is a short line of text. */
const namesAreText = vine.createRule((value: unknown, _options: undefined, field: FieldContext) => {
  for (const [language, name] of Object.entries(value as Record<string, unknown>)) {
    if (typeof name !== 'string' || name.trim() === '' || name.length > 200) {
      field.report(`The name in "${language}" must be a line of text`, 'label_text', field)
    }
  }
})

/** Names by language: English required, any other language optional. */
const labels = () =>
  vine
    .object({ en: vine.string().trim().minLength(1).maxLength(200) })
    .allowUnknownProperties<string>()
    .use(namesAreText())

const entry = () => vine.object({ reference: reference(), labels: labels() })

/** Scores by reference: what a character starts a game with in each resource. */
const scores = () => vine.record(vine.number().withoutDecimals().min(-20).max(99))

/** Skill values in percent; past 100 is possible in BRP, not past 200. */
const percentages = () => vine.record(vine.number().withoutDecimals().min(0).max(200))

/** What an untrained character has in a skill: a fixed chance, or a characteristic times a multiplier. */
const baseChance = () =>
  vine.unionOfTypes([
    vine.number().withoutDecimals().min(0).max(100),
    vine.object({
      characteristic: vine.enum(CHARACTERISTICS),
      multiplier: vine.number().withoutDecimals().min(1).max(10),
    }),
  ])

/** A dice expression as BRP writes them: `1D6+1`, `2D6`, `-1D4`. */
const isDice = vine.createRule((value: unknown, _options: undefined, field: FieldContext) => {
  if (typeof value === 'string' && !isDiceExpression(value)) {
    field.report('The {{ field }} field must be a dice expression such as 1D6+1', 'dice', field)
  }
})

/** A harm of the story: a dice expression that can deal at least one point — `12D6`, `6`, `2D4+8`. */
const isHarm = vine.createRule((value: unknown, _options: undefined, field: FieldContext) => {
  if (typeof value !== 'string') return

  if (!isDiceExpression(value)) {
    field.report('The {{ field }} field must be a dice expression such as 2D4+8', 'dice', field)
  } else if (maximumOf(parseDice(value)) < 1) {
    field.report('The {{ field }} field must be able to deal at least 1 point', 'harm', field)
  }
})

/** What stops a blow: a buff coat 1, a breastplate 6 — past 20 is a fortress. */
const armor = () => vine.number().withoutDecimals().min(0).max(20)

const combat = () =>
  vine.object({
    skills: percentages(),
    hitPointsMax: vine.number().withoutDecimals().min(1).max(999),
    weapon: reference().nullable(),
    /** As the book's creature sheets give it: `+1D4`, `-1D6`; null for none. */
    damageModifier: vine.string().trim().maxLength(40).use(isDice()).nullable(),
    armor: armor(),
  })

/** In percent, as BRP prices equipment: ±20 for a tool of quality, up to ±50 for the exceptional. */
const modifier = () =>
  vine.object({
    target: vine.enum(['skill'] as const),
    skill: reference(),
    value: vine.number().withoutDecimals().min(-50).max(50),
    condition: vine.enum(ITEM_CONDITIONS),
    description: sentence(300),
  })

const weapon = () =>
  vine.object({
    kind: vine.enum(WEAPON_KINDS),
    damage: vine.string().trim().maxLength(40).use(isDice()),
    damageModifier: vine.enum(DAMAGE_MODIFIER_USES),
    special: vine.enum(SPECIAL_EFFECTS).nullable(),
  })

const fixedDuration = () =>
  vine.enum(Object.keys(FIXED_DURATIONS) as (keyof typeof FIXED_DURATIONS)[])

/** Periods of the day, each named once. */
const periods = () => vine.array(vine.enum(PERIODS)).minLength(1).distinct()

/** A way out of a unique place: where it leads, how it reads, what shuts it. */
const exit = () =>
  vine.object({
    to: reference(),
    passage: sentence(300),
    backPassage: sentence(300).nullable(),
    hidden: vine.boolean(),
    requires: reference().nullable(),
    oneWay: vine.boolean(),
    duration: fixedDuration().nullable(),
    /** The periods nothing goes through it; left out, it is never shut by the time of day. */
    blockedDuring: vine.array(vine.enum(PERIODS)).distinct().optional(),
    blockedReason: sentence(300).nullable().optional(),
  })

/** Where a unique person is at some periods of the day, and what they do there. */
const scheduleEntry = () =>
  vine.object({
    periods: periods(),
    location: reference(),
    activity: sentence(300).nullable(),
    leavesScene: vine.boolean(),
    interrupts: vine.boolean(),
  })

const periodNote = () => vine.object({ periods: periods(), note: sentence(300) })

const initialHolder = () =>
  vine.object({
    holder: vine.enum(['npc', 'location'] as const),
    reference: reference(),
  })

const definitionBase = {
  labels: labels(),
  description: sentence(),
  kind: vine.enum(DEFINITION_KINDS),
}

const catalogueFields = {
  npcs: {
    generic: vine.boolean(),
    defaultDisposition: vine.enum(NPC_DISPOSITIONS),
    combat: combat(),
    initialLocation: reference().nullable(),
    schedule: vine.array(scheduleEntry()),
  },
  locations: {
    parent: reference().nullable(),
    exits: vine.array(exit()),
    entrance: vine.boolean(),
    periodNotes: vine.array(periodNote()),
  },
  items: {
    generic: vine.boolean(),
    stackable: vine.boolean(),
    equippable: vine.boolean(),
    modifiers: vine.array(modifier()),
    weapon: weapon().nullable(),
    armor: armor(),
    initialHolder: initialHolder().nullable(),
    /** A unique item lying in a place from the start, out of sight until found. */
    hidden: vine.boolean(),
  },
}

/**
 * A lore fragment: no names, no description — the content is the text. Its
 * tags are references; whether they name something is checked against the
 * catalogues by the controller.
 */
const loreFields = {
  kind: vine.enum(LORE_FRAGMENT_KINDS),
  content: sentence(2000),
  tags: vine.array(reference()).distinct(),
  secret: vine.boolean(),
}

/**
 * The catalogues a world or a scenario may be created with, from an imported
 * file: each entry as its own form would take it, written in one transaction
 * with what declares them.
 */
const importedCatalogues = () => ({
  npcs: vine
    .array(
      vine.object({
        reference: reference(),
        ...definitionBase,
        ...catalogueFields.npcs,
        schedule: catalogueFields.npcs.schedule.optional(),
      })
    )
    .distinct('reference')
    .optional(),
  locations: vine
    .array(
      vine.object({
        reference: reference(),
        ...definitionBase,
        ...catalogueFields.locations,
        exits: catalogueFields.locations.exits.optional(),
        entrance: catalogueFields.locations.entrance.optional(),
        periodNotes: catalogueFields.locations.periodNotes.optional(),
      })
    )
    .distinct('reference')
    .optional(),
  items: vine
    .array(
      vine.object({
        reference: reference(),
        ...definitionBase,
        ...catalogueFields.items,
        hidden: catalogueFields.items.hidden.optional(),
      })
    )
    .distinct('reference')
    .optional(),
  lore: vine
    .array(
      vine.object({
        reference: reference(),
        ...loreFields,
        tags: loreFields.tags.optional(),
        secret: loreFields.secret.optional(),
      })
    )
    .distinct('reference')
    .optional(),
})

/** An item a character starts a game with: whether it exists is checked against the catalogues. */
const startingItem = () =>
  vine.object({
    definition: reference(),
    descriptor: vine.string().trim().maxLength(300).nullable(),
    quantity: vine.number().withoutDecimals().min(1).max(999),
    equipped: vine.boolean(),
  })

/** A profession of a world: the skills it trains, what it starts a game with. */
const professionFields = {
  labels: labels(),
  description: sentence(300),
  skills: vine.array(reference()).minLength(1).maxLength(20).distinct(),
  startingItems: vine.array(startingItem()).maxLength(20),
  startingResources: scores(),
}

const worldLists = {
  narrativeTone: sentence(500),
  powerLevel: vine.enum(POWER_LEVELS),
  skills: vine
    .array(
      vine.object({
        reference: reference(),
        labels: labels(),
        category: vine.enum(SKILL_CATEGORIES),
        baseChance: baseChance(),
      })
    )
    .distinct('reference'),
  resources: vine.array(entry()).distinct('reference'),
  glossary: vine.array(entry()).distinct('reference'),
}

/**
 * A world ready to play may come from a file with everything but its
 * scenarios: its catalogues, its lore and its categories of action.
 */
export const createWorldValidator = vine.create({
  reference: reference(),
  labels: labels(),
  ...worldLists,
  /** Left out, a world is of the book's normal level. */
  powerLevel: worldLists.powerLevel.optional(),
  ...importedCatalogues(),
  professions: vine
    .array(
      vine.object({
        reference: reference(),
        ...professionFields,
        startingItems: professionFields.startingItems.optional(),
        startingResources: professionFields.startingResources.optional(),
      })
    )
    .distinct('reference')
    .optional(),
  actionTypes: vine
    .array(
      vine.object({
        actionType: reference(),
        description: sentence(),
        associatedSkill: reference().nullable().optional(),
        associatedCharacteristic: vine.enum(CHARACTERISTICS).nullable().optional(),
      })
    )
    .distinct('actionType')
    .optional(),
})

/** Everything but the reference, which never changes once created. */
export const updateWorldValidator = vine.create({
  labels: labels().optional(),
  narrativeTone: worldLists.narrativeTone.optional(),
  powerLevel: worldLists.powerLevel.optional(),
  skills: worldLists.skills.optional(),
  resources: worldLists.resources.optional(),
  glossary: worldLists.glossary.optional(),
})

/**
 * A category of action is resolved by a skill or by a characteristic: the
 * controller checks that exactly one remains, the table constraint backs it.
 */
export const createActionTypeValidator = vine.create({
  actionType: reference(),
  description: sentence(),
  associatedSkill: reference().nullable().optional(),
  associatedCharacteristic: vine.enum(CHARACTERISTICS).nullable().optional(),
})

export const updateActionTypeValidator = vine.create({
  description: sentence().optional(),
  associatedSkill: reference().nullable().optional(),
  associatedCharacteristic: vine.enum(CHARACTERISTICS).nullable().optional(),
})

/** What a scenario gives the character as a game starts, besides their profession's. */
const startingKit = () =>
  vine.object({
    items: vine.array(startingItem()).maxLength(20),
    resources: scores(),
  })

/** A new profession: equipment and resources may be left out — a profession may bring none. */
export const createProfessionValidator = vine.create({
  reference: reference(),
  ...professionFields,
  startingItems: professionFields.startingItems.optional(),
  startingResources: professionFields.startingResources.optional(),
})

export const updateProfessionValidator = vine.create(optional(professionFields))

/** A time of day, as a scenario opens on it: `HH:MM`. */
const timeOfDay = () =>
  vine
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** A day of the Gregorian calendar, `YYYY-MM-DD`, that exists: no 30th of February. */
const isCalendarDate = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'string') {
      return
    }

    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      field.report('The {{ field }} field must be a day of the calendar', 'calendar_date', field)
    }
  }
)

const calendarDate = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .use(isCalendarDate())

const initialState = () =>
  vine.object({
    location: reference(),
    chapter: reference().nullable(),
    quests: vine.array(
      vine.object({
        reference: reference(),
        step: vine.number().withoutDecimals().min(1),
        summary: sentence(500),
      })
    ),
    knownNpcs: vine.array(reference()).optional(),
  })

/** Who holds an item, as an event names them: the character, or a unique person or place. */
const eventHolder = () =>
  vine.union([
    vine.union.if(
      (value) => vine.helpers.isObject(value) && value.holder === 'character',
      vine.object({ holder: vine.literal('character') })
    ),
    vine.union.else(initialHolder()),
  ])

/** One branch of a closed list of shapes, told apart by their `type`. */
const typed = <Type extends string, Fields extends Record<string, any>>(
  type: Type,
  fields: Fields
) =>
  vine.union.if(
    (value) => vine.helpers.isObject(value) && value.type === type,
    vine.object({ type: vine.literal(type), ...fields })
  )

const unknownType = (types: readonly string[]) => (_value: unknown, field: FieldContext) => {
  field.report(`The {{ field }} field must have a type among ${types.join(', ')}`, 'type', field)
}

/** What the state must hold for an event: people and items by reference, checked at publication. */
const condition = () =>
  vine
    .union([
      typed('flag', { flag: reference() }),
      typed('item_held_by', { item: reference(), holder: eventHolder() }),
      typed('item_gone', { item: reference() }),
      typed('npc_dead', { npc: reference() }),
      typed('npc_disposition', { npc: reference(), disposition: vine.enum(NPC_DISPOSITIONS) }),
      typed('npc_at', { npc: reference(), location: reference() }),
      typed('location_visited', { location: reference() }),
    ])
    .otherwise(unknownType(EVENT_CONDITION_TYPES))

const conditions = () => vine.array(condition()).maxLength(10)

/** The two places a passage joins, either way round. */
const passage = { from: reference(), to: reference() }

/** What an event does: a closed list, applied by the backend. */
const effect = () =>
  vine
    .union([
      typed('npc_moved', { npc: reference(), location: reference() }),
      typed('npc_left', { npc: reference() }),
      typed('npc_entered', {
        npc: reference(),
        location: reference(),
        descriptor: sentence(200).nullable(),
      }),
      typed('npc_disposition', { npc: reference(), disposition: vine.enum(NPC_DISPOSITIONS) }),
      typed('schedule_stopped', { npc: reference() }),
      typed('passage_blocked', passage),
      typed('passage_cleared', passage),
      typed('passage_discovered', passage),
      typed('passage_unlocked', passage),
      typed('place_note_set', { location: reference(), note: sentence(300) }),
      typed('place_note_cleared', { location: reference() }),
      typed('item_placed', {
        item: reference(),
        holder: eventHolder(),
        quantity: vine.number().withoutDecimals().min(1).max(99),
      }),
      typed('item_transferred', { item: reference(), holder: eventHolder() }),
      typed('item_gone', { item: reference() }),
      typed('flag_set', { flag: reference() }),
      typed('character_harmed', { damage: vine.string().trim().maxLength(40).use(isHarm()) }),
      typed('game_ended', { outcome: vine.enum(GAME_OUTCOMES) }),
    ])
    .otherwise(unknownType(EVENT_EFFECT_TYPES))

/** How long after its conditions hold an event falls: a fixed span, or days within a week. */
const delay = () =>
  vine.union([
    vine.union.if(
      (value) => vine.helpers.isObject(value) && value.label === 'days',
      vine.object({
        label: vine.literal('days'),
        count: vine.number().withoutDecimals().min(1).max(MAX_DAYS),
      })
    ),
    vine.union.else(vine.object({ label: fixedDuration() })),
  ])

const scenarioEvent = () =>
  vine.object({
    reference: reference(),
    when: vine.object({
      at: vine
        .object({
          day: vine.number().withoutDecimals().min(1).max(999),
          period: vine.enum(PERIODS).nullable(),
          time: timeOfDay().nullable(),
        })
        .nullable(),
      conditions: conditions(),
      delay: delay().nullable(),
    }),
    unless: conditions(),
    place: reference().nullable(),
    description: sentence(500),
    effects: vine.array(effect()).minLength(1).maxLength(20),
    interrupts: vine.boolean(),
    foreseeable: conditions().nullable(),
  })

const scenarioFields = {
  synopsis: vine.string().trim().maxLength(4000),
  chapters: vine.array(entry()).distinct('reference'),
  quests: vine.array(entry()).distinct('reference'),
  startingKit: startingKit(),
  initialState: initialState().nullable(),
  startTime: timeOfDay(),
  startDate: calendarDate().nullable(),
  glossary: vine.array(entry()).distinct('reference'),
  flags: vine
    .array(vine.object({ reference: reference(), description: sentence(300) }))
    .distinct('reference'),
  events: vine.array(scenarioEvent()).distinct('reference'),
}

/** A scenario is created as a draft: publishing is a step of its own. */
export const createScenarioValidator = vine.create({
  reference: reference(),
  labels: labels(),
  synopsis: scenarioFields.synopsis.optional(),
  chapters: scenarioFields.chapters.optional(),
  quests: scenarioFields.quests.optional(),
  startingKit: scenarioFields.startingKit.optional(),
  initialState: scenarioFields.initialState.optional(),
  startTime: scenarioFields.startTime.optional(),
  startDate: scenarioFields.startDate.optional(),
  glossary: scenarioFields.glossary.optional(),
  flags: scenarioFields.flags.optional(),
  events: scenarioFields.events.optional(),
  ...importedCatalogues(),
})

export const updateScenarioValidator = vine.create({
  labels: labels().optional(),
  synopsis: scenarioFields.synopsis.optional(),
  chapters: scenarioFields.chapters.optional(),
  quests: scenarioFields.quests.optional(),
  startingKit: scenarioFields.startingKit.optional(),
  initialState: scenarioFields.initialState.optional(),
  startTime: scenarioFields.startTime.optional(),
  startDate: scenarioFields.startDate.optional(),
  glossary: scenarioFields.glossary.optional(),
  flags: scenarioFields.flags.optional(),
  events: scenarioFields.events.optional(),
})

export const CATALOGUES = ['npcs', 'locations', 'items', 'lore'] as const

export type Catalogue = (typeof CATALOGUES)[number]

/** Per catalogue, the validator of a new definition and of an edit to one. */
export const definitionValidators = {
  npcs: {
    /** A schedule may be left out: most people keep none. */
    create: vine.create({
      reference: reference(),
      ...definitionBase,
      ...catalogueFields.npcs,
      schedule: catalogueFields.npcs.schedule.optional(),
    }),
    update: vine.create(optional({ ...definitionBase, ...catalogueFields.npcs })),
  },
  locations: {
    /** Exits, entrance and notes may be left out: a place travelled to freely has none. */
    create: vine.create({
      reference: reference(),
      ...definitionBase,
      ...catalogueFields.locations,
      exits: catalogueFields.locations.exits.optional(),
      entrance: catalogueFields.locations.entrance.optional(),
      periodNotes: catalogueFields.locations.periodNotes.optional(),
    }),
    update: vine.create(optional({ ...definitionBase, ...catalogueFields.locations })),
  },
  items: {
    /** Hidden may be left out: an item in sight. */
    create: vine.create({
      reference: reference(),
      ...definitionBase,
      ...catalogueFields.items,
      hidden: catalogueFields.items.hidden.optional(),
    }),
    update: vine.create(optional({ ...definitionBase, ...catalogueFields.items })),
  },
  /** Tags and secrecy may be left out: a fragment sent with every turn, to every step its kind serves. */
  lore: {
    create: vine.create({
      reference: reference(),
      ...loreFields,
      tags: loreFields.tags.optional(),
      secret: loreFields.secret.optional(),
    }),
    update: vine.create(optional(loreFields)),
  },
}

/** Every field of an edit may be left out: only what is sent changes. */
function optional<Fields extends Record<string, { optional(): unknown }>>(
  fields: Fields
): { [Key in keyof Fields]: ReturnType<Fields[Key]['optional']> } {
  return Object.fromEntries(
    Object.entries(fields).map(([key, schema]) => [key, schema.optional()])
  ) as never
}
