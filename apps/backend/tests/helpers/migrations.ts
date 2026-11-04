import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'

type MigrationSource = { getMigrations(): Promise<{ name: string }[]> }

/**
 * The last migration before characters outlived their games (Phase 12): it
 * refuses to run while games exist, and the specs of earlier migrations play
 * games on the schema they migrate. They go up to here, no further.
 */
export const BEFORE_DURABLE_CHARACTERS =
  'database/migrations/1789917340000_add_professions_and_power_level'

/**
 * Driven through the runner itself rather than through `node ace`: the
 * commands regenerate `database/schema.ts`, the runner does not. `until`
 * stops going up at a migration, included.
 */
export async function migrate(
  options: { direction: 'up'; until?: string } | { direction: 'down'; step: number }
) {
  const runner = new MigrationRunner(db, app, options)

  if (options.direction === 'up' && options.until) {
    const until = options.until
    const source = (runner as unknown as { migrationSource: MigrationSource }).migrationSource
    const all = source.getMigrations.bind(source)

    source.getMigrations = async () => {
      const migrations = await all()
      return migrations.filter((migration) => migration.name <= until)
    }
  }

  await runner.run()

  if (runner.error) {
    throw runner.error
  }
}

/**
 * Back to just before a migration, whatever came after it. One file at a
 * time: the runner only counts `step` within the latest batch.
 */
export async function rollBackPast(name: string) {
  while (await db.from('adonis_schema').where('name', name).first()) {
    await migrate({ direction: 'down', step: 1 })
  }
}
