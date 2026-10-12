import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'fullName',
      'email',
      'createdAt',
      'updatedAt',
      'initials',
    ])
  }

  /**
   * The signed-in account, as it reads itself: the role too, so the
   * back-office can turn a player away at sign-in. Nowhere else — what
   * someone may do stays the backend's to decide on every request.
   */
  toSelf() {
    return { ...this.toObject(), role: this.resource.role }
  }
}
