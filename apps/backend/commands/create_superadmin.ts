import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Creates a superadmin outside the interface: the very first one, on an empty
 * database — production included, where the seeders do not run. Every other
 * account is created from the back-office.
 *
 * Asks for what it is not given; the password is typed masked, twice.
 */
export default class CreateSuperadmin extends BaseCommand {
  static commandName = 'account:create-superadmin'
  static description = 'Create a superadmin account, the first one included'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Full name of the account' })
  declare name?: string

  @flags.string({ description: 'Email the account signs in with' })
  declare email?: string

  @flags.string({ description: 'Password, for scripted use; asked masked otherwise' })
  declare password?: string

  async run() {
    const { createAccountValidator } = await import('#validators/account')
    const { createAccount } = await import('#services/accounts')
    const { errors } = await import('@vinejs/vine')

    const fullName = this.name ?? (await this.prompt.ask('Full name'))
    const email = this.email ?? (await this.prompt.ask('Email'))
    const password = this.password ?? (await this.#askPassword())

    if (password === null) {
      this.logger.error('The two passwords differ: nothing was created.')
      this.exitCode = 1
      return
    }

    try {
      const account = await createAccountValidator.validate({
        fullName,
        email,
        password,
        role: 'superadmin',
      })
      const user = await createAccount(account)

      this.logger.success(`Superadmin ${user.email} created.`)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        for (const message of error.messages as { field: string; message: string }[]) {
          this.logger.error(`${message.field}: ${message.message}`)
        }
        this.exitCode = 1
        return
      }

      throw error
    }
  }

  /** Typed twice, masked; `null` when the two differ. */
  async #askPassword(): Promise<string | null> {
    const password = await this.prompt.secure('Password')
    const confirmation = await this.prompt.secure('Password again')

    return password === confirmation ? password : null
  }
}
