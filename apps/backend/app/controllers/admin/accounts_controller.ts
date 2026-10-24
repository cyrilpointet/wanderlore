import User from '#models/user'
import { createAccount, listAccounts, reactivateAccount, suspendAccount } from '#services/accounts'
import { createAccountValidator, listAccountsValidator } from '#validators/account'
import AccountTransformer from '#transformers/admin/account_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The accounts, as a superadmin manages them: listed, created with a role,
 * suspended and reactivated. Nothing else — no role change, no email edit,
 * no deletion (roadmap, Phase 5bis).
 */
export default class AccountsController {
  async index({ request, serialize }: HttpContext) {
    const filters = await listAccountsValidator.validate(request.qs())

    return serialize(AccountTransformer.transform(await listAccounts(filters)))
  }

  /** Active from the start; the superadmin hands the password over themselves. */
  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createAccountValidator)
    const account = await createAccount(payload)

    response.status(201)

    return serialize(AccountTransformer.transform(await account.refresh()))
  }

  async suspend({ params, auth, serialize }: HttpContext) {
    const target = await User.findOrFail(params.accountId)
    const account = await suspendAccount(auth.getUserOrFail(), target)

    return serialize(AccountTransformer.transform(account))
  }

  async reactivate({ params, serialize }: HttpContext) {
    const account = await reactivateAccount(await User.findOrFail(params.accountId))

    return serialize(AccountTransformer.transform(account))
  }
}
