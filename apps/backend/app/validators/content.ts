import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

import { DEFINITION_KINDS, ITEM_CONDITIONS, NPC_DISPOSITIONS } from '#services/game/content/types'

/**
 * The game content the back-office writes. Everything a turn later reads is
 * checked here, field by field: a game master's typo is refused with the
 * field at fault, never stored to break a game afterwards.
 *
 * Nested structures — combat profiles, item modifiers, the pregenerated
 * character, the initial state — arrive as JSON written by hand: they get the
 * same treatment, with the path of the faulty field.
 *
 * Whether the content holds together as a whole (a skill naming an attribute
 * that exists…) is checked at publication, not here.
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

/** Scores by reference: a character's attributes, skills or resources. */
const scores = () => vine.record(vine.number().withoutDecimals().min(-20).max(99))

const worldLists = {
  narrativeTone: sentence(500),
  rules: vine.array(sentence()),
  ambiance: vine.array(sentence()),
  attributes: vine.array(entry()).distinct('reference'),
  skills: vine
    .array(vine.object({ reference: reference(), labels: labels(), attribute: reference() }))
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
  attributes: worldLists.attributes.optional(),
  skills: worldLists.skills.optional(),
  resources: worldLists.resources.optional(),
  glossary: worldLists.glossary.optional(),
})

export const createActionTypeValidator = vine.create({
  actionType: reference(),
  description: sentence(),
  associatedSkill: reference(),
})

export const updateActionTypeValidator = vine.create({
  description: sentence().optional(),
  associatedSkill: reference().optional(),
})

const pregeneratedCharacter = () =>
  vine.object({
    name: sentence(100),
    attributes: scores(),
    skills: scores(),
    hitPointsMax: vine.number().withoutDecimals().min(1).max(999),
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
  glossary: scenarioFields.glossary.optional(),
})

export const updateScenarioValidator = vine.create({
  labels: labels().optional(),
  synopsis: scenarioFields.synopsis.optional(),
  chapters: scenarioFields.chapters.optional(),
  quests: scenarioFields.quests.optional(),
  pregeneratedCharacter: scenarioFields.pregeneratedCharacter.optional(),
  initialState: scenarioFields.initialState.optional(),
  glossary: scenarioFields.glossary.optional(),
})

const combat = () =>
  vine.object({
    skills: vine.record(vine.number().withoutDecimals().min(0).max(20)),
    hitPointsMax: vine.number().withoutDecimals().min(1).max(999),
    weapon: reference().nullable(),
  })

/** Small values on purpose: three contextual modifiers already move a 2d6 by up to six. */
const modifier = () =>
  vine
    .object({
      target: vine.enum(['skill', 'damage'] as const),
      value: vine.number().withoutDecimals().min(-5).max(5),
      condition: vine.enum(ITEM_CONDITIONS),
      description: sentence(300),
    })
    .merge(
      vine.group([
        vine.group.if((data) => data.target === 'skill', { skill: reference() }),
        vine.group.else({}),
      ])
    )

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
  },
  items: {
    generic: vine.boolean(),
    stackable: vine.boolean(),
    equippable: vine.boolean(),
    modifiers: vine.array(modifier()),
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
    create: vine.create({
      reference: reference(),
      ...definitionBase,
      ...catalogueFields.locations,
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
