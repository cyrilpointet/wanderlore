import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Starts manual testing over: every game and its turn log go, then the
 * seeders give the test account a fresh demo game. Accounts and game content
 * stay. Run it before trying another model, so `llm:cost` measures that
 * model alone.
 *
 * Refused in production, and asks before deleting unless `--force`. Stop the
 * server first, or at least let no turn be playing: a job left in the queue
 * would look for a turn that no longer exists, and fail.
 */
export default class GameReset extends BaseCommand {
  static commandName = 'game:reset'
  static description = 'Delete every game and its turn log, then seed a fresh demo game'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Do not ask for confirmation' })
  declare force: boolean

  async run() {
    if (this.app.inProduction) {
      this.logger.error('game:reset deletes every game: it is refused in production.')
      this.exitCode = 1
      return
    }

    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { countGames, deleteAllGames } = await import('#services/game/reset')

    const { games, turns } = await countGames(db.connection())
    const target = `${games} game(s) and ${turns} logged turn(s) in "${db.connection().connectionName}"`

    if (!this.force && !(await this.prompt.confirm(`Delete ${target}?`))) {
      this.logger.info('Nothing deleted.')
      return
    }

    await db.transaction((trx) => deleteAllGames(trx))
    this.logger.success(`Deleted ${target}.`)

    /** The same seeders a fresh database gets: content first, then the test account and its game. */
    const seed = await this.kernel.exec('db:seed', [])

    if (seed.exitCode) {
      this.logger.error('Seeding failed: run "node ace db:seed" to see why.')
      this.exitCode = seed.exitCode
      return
    }

    this.logger.success('Fresh demo game ready for player@wanderlore.test.')
  }
}
