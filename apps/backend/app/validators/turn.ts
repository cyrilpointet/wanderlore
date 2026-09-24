import vine from '@vinejs/vine'

/**
 * The player's action for one turn.
 *
 * The upper bound is not cosmetic: this text is forwarded to the model, so an
 * unbounded input is an unbounded bill. Its content is never inspected or
 * sanitised — flagging a manipulation attempt is the arbitration step's job.
 */
export const playTurnValidator = vine.create({
  playerInput: vine.string().trim().minLength(1).maxLength(1000),
  headers: vine.object({
    /**
     * Required: a submission without one could not be told apart from its
     * own repetition, which is exactly the double turn this key prevents.
     * A uuid because the front generates it with `crypto.randomUUID()`.
     */
    'idempotency-key': vine.string().uuid(),
  }),
})
