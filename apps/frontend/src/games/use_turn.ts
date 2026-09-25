import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { transmit } from '@/api/transmit'
import { gameQuery, gamesQuery, turnsQuery, type Character, type Game, type Turn } from './queries'
import { channelOf, readTurn, submitTurn } from './turn_api'
import { classifySubmitError } from './turn_errors'
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

  /** Another turn holds the game (`409`): find it and wait for it instead. */
  const waitForTurnInProgress = useCallback(async () => {
    try {
      const fresh = await queryClient.fetchQuery({ ...gameQuery(gameId), staleTime: 0 })
      const turn = fresh.pendingTurn ? await readTurn(gameId, fresh.pendingTurn.id) : null
      if (turn?.status === 'completed') record(turn)
      act({ type: 'superseded', turn })
    } catch {
      act({ type: 'superseded', turn: null })
    }
  }, [queryClient, gameId, act, record])

  const send = useCallback(async () => {
    const current = latest.current
    if (current.status !== 'submitting' || !current.submission.idempotencyKey) return

    const { playerInput, idempotencyKey } = current.submission
    try {
      const turn = await submitTurn(gameId, playerInput, idempotencyKey)
      onAcceptedRef.current()
      settle(turn, { type: 'accepted', turn })
    } catch (error) {
      const outcome = classifySubmitError(error)
      switch (outcome.kind) {
        case 'card':
          return act({ type: 'submit_failed', ...outcome })
        case 'field':
          return act({ type: 'rejected', failure: outcome.failure })
        case 'wait':
          return waitForTurnInProgress()
        case 'signed_out':
          // The sign-in redirect is already under way; the draft is safe in storage.
          return
      }
    }
  }, [gameId, act, settle, waitForTurnInProgress])

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

  const inputChanged = useCallback(() => {
    if (latest.current.status === 'idle' && latest.current.inputError)
      act({ type: 'input_changed' })
  }, [act])

  return { state, subscribed, narrated, submit, retry, edit, inputChanged }
}
