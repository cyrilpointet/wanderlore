import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ApiError, NetworkError } from '@/api/client'
import { transmit } from '@/api/transmit'
import { gameQuery, gamesQuery, turnsQuery, type Character, type Game, type Turn } from './queries'
import { channelOf, readTurn, submitTurn } from './turn_api'
import {
  concerns,
  initialTurnState,
  turnReducer,
  type TurnAction,
  type TurnMessage,
  type TurnState,
} from './turn_machine'

/**
 * How long a turn may go without any news before the front reads it back.
 * Settled in KAN-25: well above the gap between two milestones of a healthy
 * turn, short enough that a lost event does not leave the player staring at
 * a waiting message. Re-armed as long as the turn stays pending.
 */
export const SILENCE_BEFORE_READ_MS = 30_000

/**
 * Plays turns for one game: subscribes to its channel before anything can be
 * sent, drives the turn machine with what the API and the channel say, and
 * writes each finished turn into the journal and the sheet.
 */
export function useTurn(game: Game, { onAccepted }: { onAccepted: () => void }) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(turnReducer, initialTurnState)
  const [subscribed, setSubscribed] = useState(false)
  const [narrated, setNarrated] = useState<string | null>(null)
  const gameId = game.id

  /**
   * The machine's latest state, updated in step with every dispatch: an
   * event can arrive between a dispatch and the render that follows it.
   */
  const latest = useRef<TurnState>(initialTurnState)
  const onAcceptedRef = useRef(onAccepted)
  useEffect(() => {
    onAcceptedRef.current = onAccepted
  })

  const act = useCallback((action: TurnAction) => {
    latest.current = turnReducer(latest.current, action)
    dispatch(action)
  }, [])

  /** A finished turn joins the journal; the sheet follows when the event carried it. */
  const record = useCallback(
    (turn: Turn, character?: Character) => {
      queryClient.setQueryData(turnsQuery(gameId).queryKey, (turns) =>
        !turns || turns.some((known) => known.id === turn.id) ? turns : [...turns, turn]
      )

      if (character) {
        queryClient.setQueryData(gameQuery(gameId).queryKey, (current) =>
          current
            ? {
                ...current,
                character,
                // The movement the backend applied is where the character now stands.
                location: turn.effects?.movement ?? current.location,
                pendingTurn: null,
              }
            : current
        )
      } else {
        // Read back rather than received: the sheet is not in the turn, so ask for it.
        void queryClient.invalidateQueries({ queryKey: gameQuery(gameId).queryKey, exact: true })
      }

      void queryClient.invalidateQueries({ queryKey: gamesQuery.queryKey, exact: true })
      setNarrated(turn.narration)
    },
    [queryClient, gameId]
  )

  /** Applies a turn read back, or answered by the `202`, recording it if it is over. */
  const settle = useCallback(
    (turn: Turn, action: TurnAction) => {
      if (turn.status === 'completed') record(turn)
      act(action)
    },
    [act, record]
  )

  const catchUp = useCallback(async () => {
    const current = latest.current
    if (current.status !== 'in_progress' || !current.submission.turnId) return

    try {
      const turn = await readTurn(gameId, current.submission.turnId)
      settle(turn, { type: 'read', turn })
    } catch {
      // Nothing better to do than wait for the next event or the next silence.
    }
  }, [gameId, settle])

  const onMessage = useCallback(
    (message: TurnMessage) => {
      if (!concerns(latest.current, message)) return
      if (message.event === 'turn_completed') record(message.turn, message.character)
      act({ type: 'message', message })
    },
    [act, record]
  )

  // Subscribed on opening the screen, before anything can be sent (architecture, section 8bis).
  useEffect(() => {
    const client = transmit()
    const subscription = client.subscription(channelOf(gameId))
    const stopListening = subscription.onMessage<TurnMessage>(onMessage)
    // A reconnection may have swallowed events: read the turn in flight back.
    const onConnected = () => void catchUp()
    let active = true

    client.on('connected', onConnected)
    subscription
      .create()
      .catch(() => {
        // Without the channel, the silence timer still catches the turn up.
      })
      .finally(() => active && setSubscribed(true))

    return () => {
      active = false
      stopListening()
      client.off('connected', onConnected)
      void subscription.delete()
    }
  }, [gameId, onMessage, catchUp])

  // A turn left running by an earlier visit: pick up where it stands.
  const pendingTurnId = game.pendingTurn?.id
  useEffect(() => {
    if (!pendingTurnId) return

    readTurn(gameId, pendingTurnId)
      .then((turn) => settle(turn, { type: 'read', turn }))
      .catch(() => {})
  }, [gameId, pendingTurnId, settle])

  // No news for too long: read the turn back, and keep doing so while it is pending.
  useEffect(() => {
    if (state.status !== 'in_progress') return

    const timer = setTimeout(() => void catchUp(), SILENCE_BEFORE_READ_MS)
    return () => clearTimeout(timer)
  }, [state, catchUp])

  const send = useCallback(async () => {
    const current = latest.current
    if (current.status !== 'submitting' || !current.submission.idempotencyKey) return

    const { playerInput, idempotencyKey } = current.submission
    try {
      const turn = await submitTurn(gameId, playerInput, idempotencyKey)
      onAcceptedRef.current()
      settle(turn, { type: 'accepted', turn })
    } catch (error) {
      act({ type: 'submit_failed', ...describeSubmitFailure(error) })
    }
  }, [gameId, act, settle])

  const submit = useCallback(
    (playerInput: string) => {
      if (latest.current.status !== 'idle') return
      act({ type: 'submit', playerInput, key: crypto.randomUUID() })
      void send()
    },
    [act, send]
  )

  const retry = useCallback(() => {
    act({ type: 'retry', key: crypto.randomUUID() })
    void send()
  }, [act, send])

  /** Takes the failed action's text back, for the player to change it. */
  const edit = useCallback((): string | null => {
    const current = latest.current
    if (current.status !== 'failed' && current.status !== 'submit_failed') return null
    act({ type: 'edit' })
    return current.submission.playerInput
  }, [act])

  return { state, subscribed, narrated, submit, retry, edit }
}

/**
 * Whether a failed POST may have reached the backend. When it may have (no
 * answer, or a server error), resending with the same key gets back the turn
 * it recorded instead of playing a second one. KAN-26 refines the rest.
 */
export function describeSubmitFailure(error: unknown): {
  failure: { code: string; message: string }
  retryWithSameKey: boolean
} {
  if (error instanceof NetworkError) {
    return { failure: { code: error.code, message: error.message }, retryWithSameKey: true }
  }

  if (error instanceof ApiError) {
    // The queue refused the turn: it is recorded as failed, so trying again is a new turn.
    const refused = error.code === 'turn_queue_unavailable'
    return {
      failure: {
        code: error.status >= 500 && !refused ? 'network_error' : (error.code ?? 'unexpected'),
        message: error.message,
      },
      retryWithSameKey: error.status >= 500 && !refused,
    }
  }

  return { failure: { code: 'unexpected', message: '' }, retryWithSameKey: false }
}
