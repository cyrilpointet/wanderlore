import Character from '#models/character'
import CharacterState from '#models/character_state'
import type { Characteristics } from '#services/rules/types'

import { characterOf } from './database.js'

/** A Gascon's characteristics, as the specs play him. */
export type PlayedSheet = Partial<{
  name: string
  gender: 'female' | 'male' | 'neutral'
  characteristics: Characteristics
  skills: Record<string, number>
  resources: Record<string, number>
  hitPoints: number
  hitPointsMax: number
}>

/**
 * The character a game is played by, with the sheet a spec needs, and their
 * state for this game: the game names its character from the start
 * (`createSession`), and a game started for real has a state.
 */
export async function playAs(
  sessionId: string,
  sheet: PlayedSheet = {}
): Promise<{ character: Character; state: CharacterState }> {
  const character = await Character.findOrFail(await characterOf(sessionId))

  character.merge({
    name: sheet.name ?? character.name,
    gender: sheet.gender ?? character.gender,
    ...(sheet.characteristics ? { characteristics: sheet.characteristics } : {}),
    skills: sheet.skills ?? {},
    progression: {},
  })
  await character.save()
  await character.load('profession')

  const state = await CharacterState.create({
    sessionId,
    characterId: character.id,
    hitPoints: sheet.hitPoints ?? 10,
    hitPointsMax: sheet.hitPointsMax ?? sheet.hitPoints ?? 10,
    resources: sheet.resources ?? {},
  })

  return { character, state }
}
