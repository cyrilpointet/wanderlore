import { BaseTransformer } from '@adonisjs/core/transformers'

import type User from '#models/user'

/**
 * An account as the superadmin manages it: its role included, which only the
 * account itself and a superadmin ever read.
 */
export default class AccountTransformer extends BaseTransformer<User> {
  toObject() {
    const user = this.resource

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.isSuspended ? 'suspended' : 'active',
      suspendedAt: user.suspendedAt,
      createdAt: user.createdAt,
    }
  }
}
