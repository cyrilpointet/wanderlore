import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import type { Registry } from '../.adonisjs/client/registry/schema.d.ts'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */
declare module '@japa/api-client/types' {
  interface RoutesRegistry extends Registry {}
}

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  dbAssertions(app),
  apiClient(),
  sessionApiClient(app),
  authApiClient(app),
]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    /**
     * The database is wired here rather than in `runnerHooks` so the `unit`
     * suite never touches PostgreSQL and stays fast.
     *
     * `truncate()` runs the migrations once and empties the tables afterwards.
     * `migrate()` would instead tear the schema down with a full
     * `migration:reset` after every run — slower, and it would paper over the
     * orphan-enum-type regression that `database/migrations.spec.ts` asserts.
     *
     * Migrations must always be driven through `testUtils.db()`: it passes
     * `--no-schema-generate`, which keeps the committed `database/schema.ts`
     * from being rewritten by a test run.
     *
     * No global `seed()`: a seeded row would become an implicit fixture every
     * test silently depends on. Each test creates what it needs.
     */
    return suite.setup(() => testUtils.db().truncate()).setup(() => testUtils.httpServer().start())
  }
}
