import vine from '@vinejs/vine'

import { CHARACTERISTICS, CHARACTER_GENDERS } from '#services/game/content/types'
import { REFERENCE } from '#validators/content'

/**
 * A character as the player builds it. Bounded here, checked as a whole by
 * the creation (`#services/rules/character_creation`): a preview may still
 * miss any field, a creation none.
 *
 * The name is the player's own text, later read by the model: bounded in
 * length here, in its characters by the creation.
 */
const points = () => vine.record(vine.number().withoutDecimals().min(0).max(999))

const draftFields = {
  worldId: vine.string().uuid(),
  /** Which result of the series goes to each characteristic, by its position in the series. */
  placement: vine
    .object(
      Object.fromEntries(
        CHARACTERISTICS.map((name) => [
          name,
          vine.number().withoutDecimals().min(0).max(6).optional(),
        ])
      ) as Record<
        (typeof CHARACTERISTICS)[number],
        ReturnType<ReturnType<typeof vine.number>['optional']>
      >
    )
    .optional(),
  profession: vine.string().trim().regex(REFERENCE).nullable().optional(),
  professionalPoints: points().optional(),
  personalPoints: points().optional(),
  name: vine.string().maxLength(200).optional(),
  gender: vine.enum(CHARACTER_GENDERS).nullable().optional(),
}

export const previewCharacterValidator = vine.create(draftFields)

/** The series it was built on: a creation from a series replaced since is refused. */
export const createCharacterValidator = vine.create({
  ...draftFields,
  rollId: vine.string().uuid(),
})

/** A game of the character: the scenario it is played from. */
export const startGameValidator = vine.create({
  scenarioId: vine.string().uuid(),
})
