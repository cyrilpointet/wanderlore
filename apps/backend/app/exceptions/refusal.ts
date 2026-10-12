/**
 * A request the backend refuses for a reason the client can act on: sent as
 * `{ error: { code, message } }`, the shape the front translates by `code`.
 *
 * `details` carries what a form needs to point at the faulty field, never
 * anything internal.
 */
export class Refusal extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'Refusal'
    this.status = status
    this.code = code
    this.details = details
  }
}
