/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import app from '@adonisjs/core/services/app'
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.Login, 'store'])

        /**
         * Scripted clients (curl, `requests/test.http`) cannot read the
         * encrypted XSRF-TOKEN cookie, so they read the raw token here and
         * send it back as `X-CSRF-TOKEN`. A browser front never needs this
         * route — it reads the cookie. Kept out of production: same-origin is
         * the only thing protecting the token from being read cross-site.
         */
        if (!app.inProduction) {
          router.get('csrf', ({ request }) => ({ csrfToken: request.csrfToken })).as('csrf')
        }
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.Login, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('scenarios', [controllers.Scenarios, 'index'])
        router.get('sessions', [controllers.Sessions, 'index'])
        router.post('sessions', [controllers.Sessions, 'store'])
        router.get('sessions/:id', [controllers.Sessions, 'show'])
        router.get('sessions/:id/turns', [controllers.Turns, 'index'])
        router.get('sessions/:id/turns/:turnId', [controllers.Turns, 'show'])
        router.post('sessions/:id/turns', [controllers.Turns, 'store'])
      })
      /**
       * A malformed id is a game or a turn that does not exist: without the
       * matchers it would reach PostgreSQL and fail there as a 500.
       */
      .where('id', router.matchers.uuid())
      .where('turnId', router.matchers.uuid())
      .as('game')
      .use(middleware.auth())

    /**
     * The back-office: game masters only. A signed-in player is refused with
     * a 403, an anonymous visitor with a 401.
     */
    router
      .group(() => {
        router.get('worlds', [controllers.admin.Worlds, 'index'])
        router.post('worlds', [controllers.admin.Worlds, 'store'])
        router.get('worlds/:worldId', [controllers.admin.Worlds, 'show'])
        router.patch('worlds/:worldId', [controllers.admin.Worlds, 'update'])
        router.delete('worlds/:worldId', [controllers.admin.Worlds, 'destroy'])

        router.get('worlds/:worldId/action-types', [controllers.admin.ActionTypes, 'index'])
        router.post('worlds/:worldId/action-types', [controllers.admin.ActionTypes, 'store'])
        router.patch('action-types/:id', [controllers.admin.ActionTypes, 'update'])
        router.delete('action-types/:id', [controllers.admin.ActionTypes, 'destroy'])

        router.get('worlds/:worldId/scenarios', [controllers.admin.Scenarios, 'index'])
        router.post('worlds/:worldId/scenarios', [controllers.admin.Scenarios, 'store'])
        router.get('scenarios/:scenarioId', [controllers.admin.Scenarios, 'show'])
        router.patch('scenarios/:scenarioId', [controllers.admin.Scenarios, 'update'])
        router.delete('scenarios/:scenarioId', [controllers.admin.Scenarios, 'destroy'])
        router.post('scenarios/:scenarioId/publish', [controllers.admin.Scenarios, 'publish'])
        router.post('scenarios/:scenarioId/unpublish', [controllers.admin.Scenarios, 'unpublish'])

        /** The three catalogues, at world level or at a scenario's. */
        router
          .get('worlds/:worldId/:catalogue', [controllers.admin.Definitions, 'index'])
          .as('definitions.world.index')
        router
          .post('worlds/:worldId/:catalogue', [controllers.admin.Definitions, 'store'])
          .as('definitions.world.store')
        router
          .get('scenarios/:scenarioId/:catalogue', [controllers.admin.Definitions, 'index'])
          .as('definitions.scenario.index')
        router
          .post('scenarios/:scenarioId/:catalogue', [controllers.admin.Definitions, 'store'])
          .as('definitions.scenario.store')
        router.patch(':catalogue/:definitionId', [controllers.admin.Definitions, 'update'])
        router.delete(':catalogue/:definitionId', [controllers.admin.Definitions, 'destroy'])
      })
      .where('worldId', router.matchers.uuid())
      .where('scenarioId', router.matchers.uuid())
      .where('definitionId', router.matchers.uuid())
      .where('id', router.matchers.uuid())
      .where('catalogue', { match: /^(npcs|locations|items)$/ })
      .prefix('admin')
      .as('admin')
      .use([middleware.auth(), middleware.role({ roles: ['game_master'] })])
  })
  .prefix('/api/v1')
