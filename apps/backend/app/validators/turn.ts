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
})
