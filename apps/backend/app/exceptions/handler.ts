import app from '@adonisjs/core/services/app'
import { errors as shieldErrors } from '@adonisjs/shield'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

import { describeTurnFailure } from '#exceptions/turn_failure'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    /**
     * Shield answers a bad CSRF token with a redirect back, which is a
     * server-rendered reflex: the API has no page to send anyone back to, and
     * the front needs a status it can tell apart from a 401.
     */
    if (error instanceof shieldErrors.E_BAD_CSRF_TOKEN) {
      return ctx.response.status(403).send({
        error: { code: 'invalid_csrf_token', message: error.message },
      })
    }

    /**
     * A pipeline failure always reaches the player — the project decided
     * against automatic retry — so it must at least say which kind it was.
     * Mapping lives here rather than in the controller, which stays thin.
     */
    const failure = describeTurnFailure(error)

    if (failure) {
      const { status, ...body } = failure

      return ctx.response.status(status).send({ error: body })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
