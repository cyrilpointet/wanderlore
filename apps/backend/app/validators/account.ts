import vine from '@vinejs/vine'

/**
 * An account created by a superadmin — or, for the very first superadmin,
 * by the bootstrap command. Same email and password rules as signing up.
 */
export const createAccountValidator = vine.create({
  fullName: vine.string().trim().minLength(1).maxLength(100),
  email: vine.string().trim().email().maxLength(254).unique({ table: 'users', column: 'email' }),
  password: vine.string().minLength(8).maxLength(32),
  role: vine.enum(['player', 'game_master', 'superadmin'] as const),
})

/** The filters of the account list. */
export const listAccountsValidator = vine.create({
  role: vine.enum(['player', 'game_master', 'superadmin'] as const).optional(),
  status: vine.enum(['active', 'suspended'] as const).optional(),
})
