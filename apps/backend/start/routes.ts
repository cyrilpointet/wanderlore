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
        router.get('sessions', [controllers.Sessions, 'index'])
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
  })
  .prefix('/api/v1')
