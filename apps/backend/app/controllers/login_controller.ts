import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'
import { AccountSuspendedError } from '#services/accounts'

/**
 * Session-based login and logout.
 *
 * The player front authenticates by session cookie rather than by access
 * token: `EventSource` cannot carry an `Authorization` header, but it sends
 * cookies natively. No token is ever handed to the browser.
 */
export default class LoginController {
  async store({ request, auth, serialize }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)

    /** Checked after the credentials: an unknown account learns nothing from this. */
    if (user.isSuspended) {
      throw new AccountSuspendedError(403)
    }

    await auth.use('web').login(user)

    return serialize(UserTransformer.transform(user))
  }

  async destroy({ auth }: HttpContext) {
    await auth.use('web').logout()

    return {
      message: 'Logged out successfully',
    }
  }
}
