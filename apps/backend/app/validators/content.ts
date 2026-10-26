import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

import {
  CHARACTERISTICS,
  DAMAGE_MODIFIER_USES,
  DEFINITION_KINDS,
  ITEM_CONDITIONS,
  NPC_DISPOSITIONS,
  SKILL_CATEGORIES,
  SPECIAL_EFFECTS,
} from '#services/game/content/types'
import { isDiceExpression } from '#services/rules/dice_expression'
import { FIXED_DURATIONS } from '#services/game/game_time'

/**
 * The game content the back-office writes. Everything a turn later reads is
 * checked here, field by field: a game master's typo is refused with the
 * field at fault, never stored to break a game afterwards.
 *
 * Nested structures — combat profiles, item modifiers, the pregenerated
 * character, the initial state — arrive as JSON written by hand: they get the
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

/** Scores by reference: a character's resources. */
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

/** The seven characteristics of BRP, each between 3 and 21 — checked closer at publication. */
const characteristics = () =>
  vine.object(
    Object.fromEntries(
      CHARACTERISTICS.map((name) => [name, vine.number().withoutDecimals().min(1).max(99)])
    ) as Record<(typeof CHARACTERISTICS)[number], ReturnType<typeof vine.number>>
  )

const worldLists = {
  narrativeTone: sentence(500),
  rules: vine.array(sentence()),
  ambiance: vine.array(sentence()),
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

export const createWorldValidator = vine.create({
  reference: reference(),
  labels: labels(),
  ...worldLists,
})

/** Everything but the reference, which never changes once created. */
export const updateWorldValidator = vine.create({
  labels: labels().optional(),
  narrativeTone: worldLists.narrativeTone.optional(),
  rules: worldLists.rules.optional(),
  ambiance: worldLists.ambiance.optional(),
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

const pregeneratedCharacter = () =>
  vine.object({
    name: sentence(100),
    characteristics: characteristics(),
    skills: percentages(),
    resources: scores(),
    items: vine.array(
      vine.object({
        definition: reference(),
        descriptor: vine.string().trim().maxLength(300).nullable(),
        quantity: vine.number().withoutDecimals().min(1).max(999),
        equipped: vine.boolean(),
      })
    ),
  })

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
  })

const scenarioFields = {
  synopsis: vine.string().trim().maxLength(4000),
  chapters: vine.array(entry()).distinct('reference'),
  quests: vine.array(entry()).distinct('reference'),
  pregeneratedCharacter: pregeneratedCharacter().nullable(),
  initialState: initialState().nullable(),
  startTime: timeOfDay(),
  startDate: calendarDate().nullable(),
  glossary: vine.array(entry()).distinct('reference'),
}

/** A scenario is created as a draft: publishing is a step of its own. */
export const createScenarioValidator = vine.create({
  reference: reference(),
  labels: labels(),
  synopsis: scenarioFields.synopsis.optional(),
  chapters: scenarioFields.chapters.optional(),
  quests: scenarioFields.quests.optional(),
  pregeneratedCharacter: scenarioFields.pregeneratedCharacter.optional(),
  initialState: scenarioFields.initialState.optional(),
  startTime: scenarioFields.startTime.optional(),
  startDate: scenarioFields.startDate.optional(),
  glossary: scenarioFields.glossary.optional(),
})

export const updateScenarioValidator = vine.create({
  labels: labels().optional(),
  synopsis: scenarioFields.synopsis.optional(),
  chapters: scenarioFields.chapters.optional(),
  quests: scenarioFields.quests.optional(),
  pregeneratedCharacter: scenarioFields.pregeneratedCharacter.optional(),
  initialState: scenarioFields.initialState.optional(),
  startTime: scenarioFields.startTime.optional(),
  startDate: scenarioFields.startDate.optional(),
  glossary: scenarioFields.glossary.optional(),
})

const combat = () =>
  vine.object({
    skills: percentages(),
    hitPointsMax: vine.number().withoutDecimals().min(1).max(999),
    weapon: reference().nullable(),
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
    skill: reference(),
    damage: vine.string().trim().maxLength(40).use(isDice()),
    damageModifier: vine.enum(DAMAGE_MODIFIER_USES),
    special: vine.enum(SPECIAL_EFFECTS).nullable(),
  })

/** A way out of a unique place: where it leads, how it reads, what shuts it. */
const exit = () =>
  vine.object({
    to: reference(),
    passage: sentence(300),
    backPassage: sentence(300).nullable(),
    hidden: vine.boolean(),
    requires: reference().nullable(),
    oneWay: vine.boolean(),
    duration: vine
      .enum(Object.keys(FIXED_DURATIONS) as (keyof typeof FIXED_DURATIONS)[])
      .nullable(),
  })

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
  },
  locations: {
    parent: reference().nullable(),
    exits: vine.array(exit()),
    entrance: vine.boolean(),
  },
  items: {
    generic: vine.boolean(),
    stackable: vine.boolean(),
    equippable: vine.boolean(),
    modifiers: vine.array(modifier()),
    weapon: weapon().nullable(),
    initialHolder: initialHolder().nullable(),
  },
}

export const CATALOGUES = ['npcs', 'locations', 'items'] as const

export type Catalogue = (typeof CATALOGUES)[number]

/** Per catalogue, the validator of a new definition and of an edit to one. */
export const definitionValidators = {
  npcs: {
    create: vine.create({ reference: reference(), ...definitionBase, ...catalogueFields.npcs }),
    update: vine.create(optional({ ...definitionBase, ...catalogueFields.npcs })),
  },
  locations: {
    /** Exits and entrance may be left out: a place travelled to freely has neither. */
    create: vine.create({
      reference: reference(),
      ...definitionBase,
      ...catalogueFields.locations,
      exits: catalogueFields.locations.exits.optional(),
      entrance: catalogueFields.locations.entrance.optional(),
    }),
    update: vine.create(optional({ ...definitionBase, ...catalogueFields.locations })),
  },
  items: {
    create: vine.create({ reference: reference(), ...definitionBase, ...catalogueFields.items }),
    update: vine.create(optional({ ...definitionBase, ...catalogueFields.items })),
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
