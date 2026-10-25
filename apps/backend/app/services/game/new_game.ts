import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import type User from '#models/user'
import Session from '#models/session'
import Scenario from '#models/scenario'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { Refusal } from '#exceptions/refusal'
import { hitPointsFor } from '#services/rules/derived'

import { loadContent } from './content/load.js'
import { resolveWorld } from './content/resolve.js'
import { type CoherenceIssue, checkScenario } from './content/coherence.js'
import { UnknownLocationError, visitUniqueLocation } from './locations.js'
import { ItemRefusedError, UnknownItemError, createItem, equipItem } from './inventory.js'

/**
 * A scenario that cannot be played from: its content does not hold together
 * — a draft without its character or its starting state, say. Publishing
 * checks it; a game master trying a draft out can still meet it.
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

/** Only a game master sees drafts: they try their scenarios out before publishing them. */
export function canPlayDrafts(user: User): boolean {
  return user.role === 'game_master'
}

/**
 * The scenarios a user may start a game from: published ones, and drafts too
 * for a game master. Ordered by world, then by title.
 */
export async function playableScenarios(user: User): Promise<Scenario[]> {
  const query = Scenario.query().preload('world')

  if (!canPlayDrafts(user)) {
    query.where('status', 'published')
  }

  const scenarios = await query

  return scenarios.sort(
    (a, b) =>
      a.world.labels.en.localeCompare(b.world.labels.en) || a.labels.en.localeCompare(b.labels.en)
  )
}

/**
 * Starts a game from a scenario: a copy of its pregenerated character and of
 * the state it starts in, written in one transaction so a game is never half
 * created.
 *
 * A scenario the user may not see reads as one that does not exist.
 */
export async function startGame(user: User, scenarioId: string): Promise<Session> {
  const query = Scenario.query().where('id', scenarioId)

  if (!canPlayDrafts(user)) {
    query.where('status', 'published')
  }

  const scenario = await query.firstOrFail()

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
  const pregenerated = scenario.pregeneratedCharacter!
  const initialState = scenario.initialState!

  return db.transaction(async (trx) => {
    const session = await Session.create(
      {
        userId: user.id,
        worldId: scenario.worldId,
        scenarioId: scenario.id,
        status: 'in_progress',
        currentChapter: initialState.chapter,
        lastActivityAt: DateTime.now(),
      },
      { client: trx }
    )

    const character = await Character.create(
      {
        sessionId: session.id,
        name: pregenerated.name,
        characteristics: pregenerated.characteristics,
        skills: pregenerated.skills,
        /** Derived, never written by hand: half of CON + SIZ. */
        hitPoints: hitPointsFor(pregenerated.characteristics),
        hitPointsMax: hitPointsFor(pregenerated.characteristics),
        resources: pregenerated.resources,
        progression: {},
      },
      { client: trx }
    )

    try {
      /** The first place of the story, with what it holds from the start. */
      const start = await visitUniqueLocation(world, session.id, initialState.location, trx)

      await WorldState.create(
        {
          sessionId: session.id,
          currentLocationId: start.id,
          activeQuests: initialState.quests,
          narrativeFlags: {},
        },
        { client: trx }
      )

      const holder = { type: 'character' as const, id: character.id }

      for (const { definition, descriptor, quantity, equipped } of pregenerated.items) {
        const item = await createItem(
          world,
          session.id,
          { definition, descriptor, quantity },
          holder,
          trx
        )

        if (equipped) {
          await equipItem(world, item)
        }
      }
    } catch (error) {
      /** The content names a place or an item the world does not have, or cannot equip. */
      if (
        error instanceof UnknownLocationError ||
        error instanceof UnknownItemError ||
        error instanceof ItemRefusedError
      ) {
        throw new ScenarioNotPlayableError('its content does not hold together.', { cause: error })
      }

      throw error
    }

    return session
  })
}
