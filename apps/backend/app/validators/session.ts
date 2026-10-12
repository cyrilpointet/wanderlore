import vine from '@vinejs/vine'

/** A new game: the scenario it is started from, and nothing else — the rest is copied from it. */
export const startGameValidator = vine.create({
  scenarioId: vine.string().uuid(),
})
