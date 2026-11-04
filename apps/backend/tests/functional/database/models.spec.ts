import { test } from '@japa/runner'

import User from '#models/user'
import TurnLog from '#models/turn_log'
import Session from '#models/session'
import Character from '#models/character'
import WorldState from '#models/world_state'
import {
  createCharacterState,
  createProfession,
  createSession,
  createTurn,
  createUser,
  createWorld,
  createWorldState,
  useTransaction,
} from '#tests/helpers/database'
import { GASCON } from '#tests/helpers/worlds'

/**
 * Rows are arranged through the query-builder factories rather than through the
 * models under test: building the fixture with the same mapping the test is
 * meant to prove would make it pass for the wrong reason.
 */
test.group('Lucid models', (group) => {
  useTransaction(group)

  test('a session reaches its owner, character, their state, world state and turns', async ({
    assert,
  }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)
    await createCharacterState(sessionId)
    await createWorldState(sessionId)
    await createTurn(sessionId, 1)

    /**
     * Preloading is the only path that actually resolves the foreign key and
     * the table name — reading an already known id would prove nothing. The
     * `turns` preload is the one that pins `static table = 'turn_log'`: without
     * it Lucid looks for `turn_logs`, and only at query time.
     */
    const session = await Session.query()
      .where('id', sessionId)
      .preload('user')
      .preload('character', (character) => character.preload('profession'))
      .preload('characterState')
      .preload('worldState')
      .preload('turns')
      .firstOrFail()

    assert.equal(session.user.id, userId)
    assert.equal(session.character.id, session.characterId)
    assert.equal(session.character.profession.id, session.character.professionId)
    assert.equal(session.characterState.sessionId, sessionId)
    assert.equal(session.worldState.sessionId, sessionId)
    assert.lengthOf(session.turns, 1)
  })

  test('a turn reaches back to its session', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const turn = await TurnLog.findOrFail(await createTurn(sessionId, 1))

    await turn.load('session')

    assert.equal(turn.session.id, sessionId)
  })

  test('an account reaches its sessions', async ({ assert }) => {
    const userId = await createUser()
    await createSession(userId)
    await createSession(userId)

    const user = await User.query().where('id', userId).preload('sessions').firstOrFail()

    assert.lengthOf(user.sessions, 2)
  })

  test('a jsonb object survives a write and a fresh read', async ({ assert }) => {
    const userId = await createUser()
    const worldId = await createWorld()

    const created = await Character.create({
      userId,
      worldId,
      professionId: await createProfession(worldId),
      name: "d'Artagnan",
      gender: 'male',
      characteristics: GASCON,
      skills: { swordsmanship: 2 },
      progression: {},
    })

    /**
     * Re-read rather than asserting on the in-memory instance, which would only
     * prove the property was assigned.
     */
    const reloaded = await Character.findOrFail(created.id)

    assert.deepEqual(reloaded.characteristics, GASCON)
    assert.deepEqual(reloaded.skills, { swordsmanship: 2 })
  })

  test('a jsonb array survives a write and a fresh read', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const created = await WorldState.create({
      sessionId,
      activeQuests: [{ reference: 'recover_the_seal', step: 1 }],
      narrativeFlags: { queens_favour_earned: true },
    })

    const reloaded = await WorldState.findOrFail(created.id)

    assert.deepEqual(reloaded.activeQuests, [{ reference: 'recover_the_seal', step: 1 }])
    assert.deepEqual(reloaded.narrativeFlags, { queens_favour_earned: true })
  })

  test('an unwritten jsonb column stays SQL NULL', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const turn = await TurnLog.findOrFail(await createTurn(sessionId, 1))

    /**
     * A turn that fails mid-pipeline must leave these empty rather than hold a
     * JSON `null`, which would read back as a value.
     */
    assert.isNull(turn.rollResult)
    assert.isNull(turn.appliedEffects)
  })

  test('a turn defaults to the English game language', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const turn = await TurnLog.findOrFail(await createTurn(sessionId, 1))

    /**
     * The factory writes no language, so this covers both the column default
     * and the fact that the column is mapped at all.
     */
    assert.equal(turn.language, 'en')
  })
})
