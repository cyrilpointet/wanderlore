import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export type GamesCount = {
  games: number
  turns: number
}

/** What a reset would remove. */
export async function countGames(client: QueryClientContract): Promise<GamesCount> {
  const [games] = await client.from('sessions').count('* as total')
  const [turns] = await client.from('turn_log').count('* as total')

  return { games: Number(games.total), turns: Number(turns.total) }
}

/**
 * Deletes every game, and with it everything a game owns: its character, its
 * world state, its turn log, its places and its people — the foreign keys
 * cascade. Accounts and game content (`resolution_rules`) are kept.
 *
 * For manual testing only: the turn log is the cost record, and this wipes it.
 */
export async function deleteAllGames(client: QueryClientContract): Promise<GamesCount> {
  const before = await countGames(client)

  await client.from('sessions').delete()

  return before
}
