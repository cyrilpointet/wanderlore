import type { HttpContext } from '@adonisjs/core/http'

import { Refusal } from '#exceptions/refusal'

/**
 * A reference is the identity of content: games and other content name it.
 * Sent again unchanged, it is ignored; changed, it is refused.
 */
export function refuseReferenceChange(request: HttpContext['request'], current: string) {
  const sent = request.input('reference')

  if (sent !== undefined && sent !== current) {
    throw new Refusal(422, 'reference_immutable', 'A reference never changes once created.', {
      field: 'reference',
    })
  }
}

/** A reference already taken where it has to be unique. */
export function referenceTaken(reference: string): Refusal {
  return new Refusal(409, 'reference_taken', `The reference "${reference}" is already taken.`, {
    field: 'reference',
  })
}
