import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Session from '#models/session'
import { Refusal } from '#exceptions/refusal'

/**
 * How a game ends, and what an ended game still allows (roadmap, Phase 12).
 * A game is closed once `completed` or `failed`: its journal is read back,
 * no turn is played in it any more.
 */

/** The statuses of a game still being played: the character is engaged in it. */
export const ONGOING_STATUSES = ['in_progress', 'paused'] as const

export function isOngoing(session: Pick<Session, 'status'>): boolean {
  return (ONGOING_STATUSES as readonly string[]).includes(session.status)
}

/** A turn sent to a game that ended: it reads on, but plays no more. */
export class GameEndedError extends Refusal {
  constructor() {
    super(409, 'game_ended', 'This game is over: no turn can be played in it any more.')
  }
}

/** Only a failed game is deleted: an ongoing one is abandoned first, a success is kept. */
export class GameNotFailedError extends Refusal {
  constructor() {
    super(409, 'game_not_failed', 'Only a failed game can be deleted.')
  }
}

/**
 * A game of the player, locked for the rest of the transaction: submitting a
 * turn and abandoning the game both take this lock, so neither slips in
 * while the other decides. A deleted game, or one of a deleted character,
 * reads as one that does not exist.
 */
export function lockOwnGame(
  sessionId: string,
  userId: string,
  trx: TransactionClientContract
): Promise<Session> {
  return Session.query({ client: trx })
    .where('id', sessionId)
    .where('userId', userId)
    .withScopes((scopes) => scopes.listed())
    .forUpdate()
    .firstOrFail()
}

/**
 * The player gives the game up: it fails, and closes. Refused while a turn
 * is being played — the turn would land in a game already over — and for a
 * game that ended already.
 */
export async function abandonGame(sessionId: string, userId: string): Promise<Session> {
  return db.transaction(async (trx) => {
    const session = await lockOwnGame(sessionId, userId, trx)

    if (!isOngoing(session)) {
      throw new GameEndedError()
    }

    const pending = await trx
      .from('turn_log')
      .where('session_id', session.id)
      .where('status', 'pending')
      .first()

    if (pending) {
      /** The code a second turn sent too soon gets: the answer is the same — wait. */
      throw new Refusal(
        409,
        'turn_already_in_progress',
        'A turn is being played in this game: wait for it to finish.'
      )
    }

    session.merge({ status: 'failed', endedAt: DateTime.now() })
    await session.useTransaction(trx).save()

    return session
  })
}
