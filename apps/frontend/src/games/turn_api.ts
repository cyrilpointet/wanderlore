import { api } from '@/api/client'
import type { Turn } from './queries'

/** The game's SSE channel (architecture, section 8bis). */
export function channelOf(gameId: string): string {
  return `sessions/${gameId}`
}

/**
 * Hands the player's action over. The answer is a `202` with the turn,
 * pending — or as it stands, when the key names a turn already recorded.
 */
export async function submitTurn(
  gameId: string,
  playerInput: string,
  idempotencyKey: string
): Promise<Turn> {
  const { data } = await api<{ data: Turn }>(`/sessions/${gameId}/turns`, {
    method: 'POST',
    body: { playerInput },
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return data
}

/** A turn whatever its status: how the front catches up on events it missed. */
export async function readTurn(gameId: string, turnId: string): Promise<Turn> {
  const { data } = await api<{ data: Turn }>(`/sessions/${gameId}/turns/${turnId}`)
  return data
}
