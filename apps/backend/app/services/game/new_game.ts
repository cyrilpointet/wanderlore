import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import type User from '#models/user'
import Session from '#models/session'
import Scenario from '#models/scenario'
import Profession from '#models/profession'
import type Character from '#models/character'
import WorldState from '#models/world_state'
import CharacterState from '#models/character_state'
import { Refusal } from '#exceptions/refusal'
import { hitPointsFor } from '#services/rules/derived'

import { loadContent } from './content/load.js'
import { resolveWorld } from './content/resolve.js'
import { type CoherenceIssue, checkScenario } from './content/coherence.js'
import type { StartingItem } from './content/types.js'
import { secondsOfTime } from './game_time.js'
import { followSchedules } from './apply_events.js'
import { UnknownLocationError, visitUniqueLocation } from './locations.js'
import { meetThoseWaiting } from './npcs.js'
import { ItemRefusedError, UnknownItemError, createItem, equipItem } from './inventory.js'

/**
 * A scenario that cannot be played from: its content does not hold together
 * — a draft without its starting state, say. Publishing checks it; a game
 * master trying a draft out can still meet it.
 */
export class ScenarioNotPlayableError extends Refusal {
  constructor(reason: string, options?: ErrorOptions & { issues?: CoherenceIssue[] }) {
    super(
      422,
      'scenario_not_playable',
      `This scenario cannot be played yet: ${reason}`,
      options?.issues ? { issues: options.issues } : undefined
    )

    if (options?.cause) {
      this.cause = options.cause
    }
  }
}

/** The character already plays a game, in progress or paused: one at a time. */
export class CharacterEngagedError extends Refusal {
  constructor() {
    super(
      409,
      'character_engaged',
      'This character is already playing a game: finish or abandon it first.'
    )
  }
}

/** The character already won this scenario: a success is not played again. */
export class ScenarioCompletedError extends Refusal {
  constructor() {
    super(409, 'scenario_completed', 'This character already completed this scenario.')
  }
}

/** Only a game master sees drafts: they try their scenarios out before publishing them. */
export function canPlayDrafts(user: User): boolean {
  return user.role === 'game_master'
}

/**
 * The scenarios a user may play in a world: published ones, and drafts too
 * for a game master. Ordered by title.
 */
export async function playableScenarios(user: User, worldId: string): Promise<Scenario[]> {
  const query = Scenario.query().where('worldId', worldId)

  if (!canPlayDrafts(user)) {
    query.where('status', 'published')
  }

  const scenarios = await query

  return scenarios.sort((a, b) => a.labels.en.localeCompare(b.labels.en))
}

/** Whether the character is in a game, in progress or paused. */
export async function isEngaged(characterId: string): Promise<boolean> {
  const engaged = await Session.query()
    .where('characterId', characterId)
    .whereIn('status', ['in_progress', 'paused'])
    .first()

  return engaged !== null
}

const PG_UNIQUE_VIOLATION = '23505'
const ONE_GAME_PER_CHARACTER = 'sessions_one_game_per_character'

/**
 * Starts a game of a scenario for a character of its world: their state for
 * this game at full hit points, the equipment of their profession then the
 * scenario's, a copy of the state the story starts in and of when it opens —
 * written in one transaction so a game is never half created.
 *
 * A scenario the user may not see, or of another world, reads as one that
 * does not exist. The character plays one game at a time, and never again a
 * scenario they completed; a scenario they failed starts afresh.
 */
export async function startGame(
  user: User,
  character: Character,
  scenarioId: string
): Promise<Session> {
  const query = Scenario.query().where('id', scenarioId).where('worldId', character.worldId)

  if (!canPlayDrafts(user)) {
    query.where('status', 'published')
  }

  const scenario = await query.firstOrFail()

  if (await isEngaged(character.id)) {
    throw new CharacterEngagedError()
  }

  const completed = await Session.query()
    .where('characterId', character.id)
    .where('scenarioId', scenario.id)
    .where('status', 'completed')
    .first()

  if (completed) {
    throw new ScenarioCompletedError()
  }

  /**
   * Checked again here, not only at publication: content edited since may
   * have broken it, and a draft a game master tries out was never checked.
   */
  const content = await loadContent({ worldId: scenario.worldId, scenarioId: scenario.id })
  const issues = checkScenario(content.world, content.scenario)

  if (issues.length > 0) {
    throw new ScenarioNotPlayableError('its content does not hold together.', { issues })
  }

  const world = resolveWorld(content.world, content.scenario)
  const profession = await Profession.findOrFail(character.professionId)
  const kit = scenario.startingKit
  const initialState = scenario.initialState!

  try {
    return await db.transaction(async (trx) => {
      const session = await Session.create(
        {
          userId: user.id,
          worldId: scenario.worldId,
          scenarioId: scenario.id,
          characterId: character.id,
          status: 'in_progress',
          currentChapter: initialState.chapter,
          lastActivityAt: DateTime.now(),
        },
        { client: trx }
      )

      /** Derived, never written by hand: the game starts at full hit points. */
      const hitPoints = hitPointsFor(character.characteristics)
      await CharacterState.create(
        {
          sessionId: session.id,
          characterId: character.id,
          hitPoints,
          hitPointsMax: hitPoints,
          resources: sumResources(profession.startingResources, kit.resources),
        },
        { client: trx }
      )

      try {
        /** The first place of the story, with what it holds and who waits there from the start. */
        const start = await visitUniqueLocation(world, session.id, initialState.location, trx)
        /** And whoever their schedule has there as the story opens. */
        await followSchedules(
          {
            world,
            sessionId: session.id,
            place: { id: start.id, reference: initialState.location },
          },
          { gameTime: secondsOfTime(scenario.startTime), stopped: new Set() },
          trx
        )
        await meetThoseWaiting(session.id, start.id, trx)

        await WorldState.create(
          {
            sessionId: session.id,
            currentLocationId: start.id,
            activeQuests: initialState.quests,
            narrativeFlags: {},
            /** Whose names the character knows before meeting anyone. */
            knownNpcs: initialState.knownNpcs ?? [],
            /** The clock opens at the scenario's time on its first day, and runs from there. */
            gameTime: secondsOfTime(scenario.startTime),
            startDate: scenario.startDate,
          },
          { client: trx }
        )

        const holder = { type: 'character' as const, id: character.id }

        /** The tools of their trade, then what the story gives them. */
        for (const entry of [...profession.startingItems, ...kit.items]) {
          await giveItem(world, session.id, entry, holder, trx)
        }
      } catch (error) {
        /** The content names a place or an item the world does not have, or cannot equip. */
        if (
          error instanceof UnknownLocationError ||
          error instanceof UnknownItemError ||
          error instanceof ItemRefusedError
        ) {
          throw new ScenarioNotPlayableError('its content does not hold together.', {
            cause: error,
          })
        }

        throw error
      }

      return session
    })
  } catch (error) {
    /** Two starts racing each other: the index lets one through, the other is told why. */
    const candidate = error as { code?: string; constraint?: string }

    if (
      candidate?.code === PG_UNIQUE_VIOLATION &&
      candidate?.constraint === ONE_GAME_PER_CHARACTER
    ) {
      throw new CharacterEngagedError()
    }

    throw error
  }
}

async function giveItem(
  world: Parameters<typeof createItem>[0],
  sessionId: string,
  { definition, descriptor, quantity, equipped }: StartingItem,
  holder: { type: 'character'; id: string },
  trx: Parameters<typeof createItem>[4]
) {
  const item = await createItem(world, sessionId, { definition, descriptor, quantity }, holder, trx)

  if (equipped) {
    await equipItem(world, item)
  }
}

/** What the profession and the scenario give, added up resource by resource. */
export function sumResources(...sources: Record<string, number>[]): Record<string, number> {
  const total: Record<string, number> = {}

  for (const source of sources) {
    for (const [reference, value] of Object.entries(source)) {
      total[reference] = (total[reference] ?? 0) + value
    }
  }

  return total
}
