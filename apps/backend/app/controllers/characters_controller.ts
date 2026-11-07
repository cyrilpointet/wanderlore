import { DateTime } from 'luxon'

import type Session from '#models/session'
import Character from '#models/character'
import { ContentLabels, inLanguage } from '#services/game/content_labels'
import { loadWorld, loadWorldLevel, loadWorlds } from '#services/game/content/load'
import {
  createCharacterFrom,
  findCreatableWorld,
  previewCharacter,
} from '#services/game/character_creation'
import {
  CharacterEngagedError,
  isEngaged,
  playableScenarios,
  startGame,
} from '#services/game/new_game'
import { isOngoing } from '#services/game/game_lifecycle'
import {
  createCharacterValidator,
  previewCharacterValidator,
  startGameValidator,
} from '#validators/character'
import { sheetOf } from '#transformers/character_transformer'
import SessionTransformer from '#transformers/session_transformer'
import type { HttpContext } from '@adonisjs/core/http'

import { findGame } from './sessions_controller.js'

/**
 * The player's characters, each of a world for good, and the games they play
 * — one at a time. Every lookup is scoped to the player asking, so someone
 * else's character is indistinguishable from one that does not exist — as is
 * a character the player deleted.
 */
export default class CharactersController {
  /**
   * The player's characters: those in a game first, with the game to go back
   * to, then by their last activity.
   */
  async index({ auth }: HttpContext) {
    const characters = await ownCharacters(auth.getUserOrFail().id)
    const ongoing = characters.flatMap((character) => character.sessions.filter(isOngoing))
    const worldOf = await loadWorlds(ongoing)

    const cards = await Promise.all(
      characters.map(async (character) => {
        const game = character.sessions.find(isOngoing) ?? null
        const labels = new ContentLabels(
          game ? worldOf(game) : await loadWorldLevel(character.worldId)
        )

        return {
          ...identityOf(character, labels),
          lastActivityAt: lastActivityOf(character),
          game: game === null ? null : gameCardOf(game, labels),
        }
      })
    )

    return {
      data: cards.sort(
        (a, b) =>
          Number(b.game !== null) - Number(a.game !== null) ||
          b.lastActivityAt.toMillis() - a.lastActivityAt.toMillis()
      ),
    }
  }

  /**
   * A character's page: their sheet, the game they play, the scenarios of
   * their world they may start — those they completed aside, those they
   * failed marked — and the games they played.
   */
  async show({ params, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const character = await findOwnCharacter(params.id, user.id)
    const labels = new ContentLabels(await loadWorldLevel(character.worldId))
    const games = character.sessions
    const ongoing = games.find(isOngoing) ?? null

    const completed = new Set(
      games.filter(({ status }) => status === 'completed').map(({ scenarioId }) => scenarioId)
    )
    const failed = new Set(
      games.filter(({ status }) => status === 'failed').map(({ scenarioId }) => scenarioId)
    )
    const playable = await playableScenarios(user, character.worldId)
    const scenarios = playable.filter(({ id }) => !completed.has(id))
    const worldOf = await loadWorlds(games)

    return {
      data: {
        ...identityOf(character, labels),
        ...sheetOf(character, labels),
        engaged: ongoing !== null,
        game: ongoing === null ? null : gameCardOf(ongoing, new ContentLabels(worldOf(ongoing))),
        scenarios: scenarios.map((scenario) => ({
          id: scenario.id,
          title: inLanguage(scenario.labels, 'en'),
          synopsis: scenario.synopsis,
          status: scenario.status,
          failed: failed.has(scenario.id),
        })),
        pastGames: games
          .filter((game) => !isOngoing(game))
          .sort((a, b) => (b.endedAt?.toMillis() ?? 0) - (a.endedAt?.toMillis() ?? 0))
          .map((game) => ({
            id: game.id,
            status: game.status,
            endedAt: game.endedAt,
            endReason: game.endReason ?? null,
            scenario: { id: game.scenarioId, title: inLanguage(game.scenario.labels, 'en') },
          })),
      },
    }
  }

  /** The sheet the draft makes, and what is wrong with it: nothing is written. */
  async preview({ request, auth }: HttpContext) {
    const { worldId, ...payload } = await request.validateUsing(previewCharacterValidator)
    const user = auth.getUserOrFail()
    const world = await findCreatableWorld(user, worldId)

    return { data: await previewCharacter(user, world, payload) }
  }

  /** The character the draft describes, once it holds together: their page follows. */
  async store({ request, response, auth }: HttpContext) {
    const { worldId, ...payload } = await request.validateUsing(createCharacterValidator)
    const user = auth.getUserOrFail()
    const world = await findCreatableWorld(user, worldId)

    const character = await createCharacterFrom(user, world, payload)
    response.status(201)

    return { data: { id: character.id } }
  }

  /**
   * Starts a game of a scenario of the character's world, and answers with it
   * in the shape the game screen reads, so the front goes straight to it.
   */
  async play({ params, request, response, auth, serialize }: HttpContext) {
    const { scenarioId } = await request.validateUsing(startGameValidator)
    const user = auth.getUserOrFail()
    const character = await Character.query()
      .where('id', params.id)
      .where('userId', user.id)
      .withScopes((scopes) => scopes.listed())
      .firstOrFail()

    const created = await startGame(user, character, scenarioId)
    const session = await findGame(created.id, user.id)
    const labels = new ContentLabels(await loadWorld(session))

    response.status(201)

    return serialize(SessionTransformer.transform(session, () => labels))
  }

  /**
   * Removes a character from the player's list, with their games. Soft: they
   * stay in the base. Refused while they play a game: it is abandoned first.
   */
  async destroy({ params, auth, response }: HttpContext) {
    const character = await Character.query()
      .where('id', params.id)
      .where('userId', auth.getUserOrFail().id)
      .withScopes((scopes) => scopes.listed())
      .firstOrFail()

    if (await isEngaged(character.id)) {
      throw new CharacterEngagedError()
    }

    character.deletedAt = DateTime.now()
    await character.save()

    return response.noContent()
  }
}

/** The player's characters still on their list, each with their games still on it. */
function ownCharacters(userId: string) {
  return Character.query()
    .where('userId', userId)
    .withScopes((scopes) => scopes.listed())
    .preload('profession')
    .preload('world')
    .preload('sessions', (sessions) =>
      sessions
        .whereNull('deletedAt')
        .preload('scenario')
        .preload('characterState')
        .orderBy('lastActivityAt', 'desc')
    )
}

function findOwnCharacter(characterId: string, userId: string) {
  return ownCharacters(userId).where('id', characterId).firstOrFail()
}

function identityOf(character: Character, labels: ContentLabels) {
  return {
    id: character.id,
    name: character.name,
    gender: character.gender,
    world: labels.world(),
    profession: labels.of('profession', character.profession.reference),
    createdAt: character.createdAt,
  }
}

/** The last game they played, or when they were made. */
function lastActivityOf(character: Character): DateTime {
  const [last] = character.sessions

  return last && last.lastActivityAt > character.createdAt
    ? last.lastActivityAt
    : character.createdAt
}

/** The game a character plays, as a card shows it. */
function gameCardOf(game: Session, labels: ContentLabels) {
  const chapter = game.currentChapter

  return {
    id: game.id,
    status: game.status,
    lastActivityAt: game.lastActivityAt,
    scenario: { id: game.scenarioId, title: inLanguage(game.scenario.labels, 'en') },
    chapter: chapter === null ? null : labels.of('chapter', chapter),
    hitPoints: game.characterState?.hitPoints ?? null,
    hitPointsMax: game.characterState?.hitPointsMax ?? null,
  }
}
