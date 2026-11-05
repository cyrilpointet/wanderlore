import db from '@adonisjs/lucid/services/db'

import type User from '#models/user'
import World from '#models/world'
import Character from '#models/character'
import Profession from '#models/profession'
import CharacterRoll from '#models/character_roll'
import { Refusal } from '#exceptions/refusal'
import type { DiceService } from '#services/dice'
import {
  type CharacterDraft,
  type CreationResult,
  type CreationWorld,
  DICE_PER_RESULT,
  type ResultDice,
  createCharacter,
  isComplete,
  keepBestThree,
} from '#services/rules/character_creation'

import { canPlayDrafts } from './new_game.js'

/**
 * Creating a character in a world, around the pure calculation of the rules:
 * the series rolled and kept in the base, the preview, the creation that
 * consumes the series (roadmap, Phase 12).
 */

/** Seven results, one for each characteristic, in the order of the series. */
export const SERIES_LENGTH = 7

/**
 * The worlds a user may create a character in: those with a scenario they
 * may play — published, drafts too for a game master. A world with nothing
 * to play reads as one that does not exist.
 */
export function creatableWorlds(user: User) {
  return World.query()
    .whereExists((scenarios) => {
      scenarios.from('scenarios').whereColumn('scenarios.world_id', 'worlds.id')

      if (!canPlayDrafts(user)) {
        scenarios.where('scenarios.status', 'published')
      }
    })
    .orderBy('reference')
}

export function findCreatableWorld(user: User, worldId: string) {
  return creatableWorlds(user).where('id', worldId).firstOrFail()
}

/** What the creation reads of a world: its level, its skills, its professions. */
export async function creationWorldOf(world: World): Promise<{
  world: CreationWorld
  professions: Profession[]
}> {
  const professions = await Profession.query().where('worldId', world.id).orderBy('reference')

  return {
    world: { powerLevel: world.powerLevel, skills: world.skills, professions },
    professions,
  }
}

/**
 * Rolls a new series for the player, replacing the one they had: four d6 for
 * each result, the three best kept. The dice come back too, with the one set
 * aside, for the front to show them landing; only the totals are kept, which
 * is all the creation places.
 */
export async function rollSeries(
  user: User,
  dice: DiceService
): Promise<{ roll: CharacterRoll; dice: ResultDice[] }> {
  const rolled = Array.from({ length: SERIES_LENGTH }, () =>
    keepBestThree(Array.from({ length: DICE_PER_RESULT }, () => dice.rollDie(6)))
  )
  const values = rolled.map(({ value }) => value)

  const roll = await db.transaction(async (trx) => {
    await CharacterRoll.query({ client: trx }).where('userId', user.id).delete()

    return CharacterRoll.create({ userId: user.id, values }, { client: trx })
  })

  return { roll, dice: rolled }
}

export type DraftPayload = Partial<Omit<CharacterDraft, 'placement'>> & {
  placement?: CharacterDraft['placement']
}

function draftOf(payload: DraftPayload): CharacterDraft {
  return {
    placement: payload.placement ?? {},
    profession: payload.profession ?? null,
    professionalPoints: payload.professionalPoints ?? {},
    personalPoints: payload.personalPoints ?? {},
    name: payload.name ?? '',
    gender: payload.gender ?? null,
  }
}

/** The sheet the draft makes, and what is wrong with it: nothing is written. */
export async function previewCharacter(
  user: User,
  world: World,
  payload: DraftPayload
): Promise<CreationResult> {
  const roll = await CharacterRoll.findBy('userId', user.id)
  const { world: creation } = await creationWorldOf(world)

  return createCharacter(creation, roll?.values ?? null, draftOf(payload))
}

/** The draft cannot make a character: the first fault, and every one of them. */
export class InvalidCharacterError extends Refusal {
  constructor(result: CreationResult) {
    const [first] = result.issues

    super(422, first.code, 'This character cannot be created as it stands.', {
      field: first.field,
      issues: result.issues,
    })
  }
}

/**
 * Creates the character the draft describes, checked again from scratch,
 * and consumes the series it was built on. A series replaced since — a reroll
 * in another tab — refuses it: the player places only what they rolled last.
 */
export async function createCharacterFrom(
  user: User,
  world: World,
  payload: DraftPayload & { rollId: string }
): Promise<Character> {
  return db.transaction(async (trx) => {
    const roll = await CharacterRoll.query({ client: trx })
      .where('userId', user.id)
      .forUpdate()
      .first()

    if (roll === null) {
      throw new Refusal(422, 'no_characteristic_roll', 'Roll your characteristics first.', {
        field: 'placement',
      })
    }
    if (roll.id !== payload.rollId) {
      throw new Refusal(
        409,
        'stale_characteristic_roll',
        'These characteristics were rolled again since: place the new ones.',
        { field: 'placement' }
      )
    }

    const { world: creation, professions } = await creationWorldOf(world)
    const draft = draftOf(payload)
    const result = createCharacter(creation, roll.values, draft)

    if (result.issues.length > 0 || !isComplete(result.sheet.characteristics)) {
      throw new InvalidCharacterError(result)
    }

    const profession = professions.find(({ reference }) => reference === draft.profession)!

    const character = await Character.create(
      {
        userId: user.id,
        worldId: world.id,
        professionId: profession.id,
        name: draft.name.trim(),
        gender: draft.gender!,
        characteristics: result.sheet.characteristics,
        /** The skills trained: any other is worth its base chance, on the same characteristics. */
        skills: Object.fromEntries(
          result.sheet.skills
            .filter(({ professional, personal }) => professional + personal > 0)
            .map(({ reference, value }) => [reference, value!])
        ),
        progression: {},
      },
      { client: trx }
    )

    await roll.useTransaction(trx).delete()

    return character
  })
}
