import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import gameConfig from '#config/game'

import TurnLog from '#models/turn_log'
import Session from '#models/session'
import type Character from '#models/character'
import type CharacterState from '#models/character_state'
import { GameEndedError, isOngoing, lockOwnGame } from '#services/game/game_lifecycle'
import type WorldState from '#models/world_state'
import LocationInstance from '#models/location_instance'
import NpcInstance from '#models/npc_instance'
import type EventState from '#models/event_state'
import type { LlmGateway } from '#services/llm/gateway'
import type { RulesEngine } from '#services/rules/engine'
import type { Clock } from '#services/clock'
import type { JobQueue } from '#services/queue/types'
import type { TurnEvents, TurnRef } from '#services/game/turn_events'
import { toNarrationOutcome } from '#services/rules/engine'
import type { RollResolution } from '#services/rules/types'

import {
  ConcurrentTurnError,
  QueueUnavailableError,
  StaleTurnError,
  isTurnNumberConflict,
} from './errors.js'
import { applyDelta } from './apply_delta.js'
import {
  type PresentNpc,
  enterableNpcs,
  nextHandleOf,
  guardedPlaces,
  meetThoseWaiting,
  metNpcs,
  npcsPlacedIn,
  npcsWaitingIn,
  presentNpcDefinitions,
  presentNpcs,
} from './npcs.js'
import {
  type ItemsInScene,
  characterItems,
  creatableItems,
  itemsInScene,
  modifierSources,
  sceneItemsOf,
} from './inventory.js'
import { actionTypesOf, resolutionFor, rollBaseFor } from './resolution_rules.js'
import { ContentLabels } from './content_labels.js'
import { DAY, FIXED_DURATIONS, MAX_DAYS, periodAt, secondsOf } from './game_time.js'
import {
  type DueEvent,
  type WorldSnapshot,
  awaitedTimeOf,
  foreseeableEvents,
  timedEventsDue,
  witnesses,
} from './events.js'
import {
  eventsSince,
  loadProgress,
  loadSnapshot,
  placeNoteOf,
  placesAround,
  progressReader,
  stoppedSchedules,
  untoldEvents,
} from './game_events.js'
import {
  applyEvent,
  followSchedules,
  markTold,
  recordEvent,
  settleStateEvents,
} from './apply_events.js'
import {
  type ScheduledNpc,
  entryAt,
  movesWithin,
  nextArrivalIn,
  scheduledNpcs,
} from './schedules.js'
import type { ScenarioEvent } from './content/types.js'
import { passageStates } from './passages.js'
import {
  type Route,
  type SceneExit,
  type TravelState,
  destinationsFrom,
  exitsOf,
  improvisationParents,
  routesFrom,
  withExitsOpened,
} from './travel.js'
import { TurnBudget } from './turn_budget.js'
import {
  DOWN_SECONDS,
  ROUND_SECONDS,
  type Opponent,
  type Round,
  narratedRound,
  playRound,
} from './combat.js'
import { applyFirstAid, applyRound, heal, letTheDyingDie, stopBleeding } from './apply_combat.js'
import { FIRST_AID } from './system_references.js'
import { characterRolls } from '#transformers/turn_transformer'
import { callStructured } from './structured_call.js'
import { loadWorld } from './content/load.js'
import { loreFor, loreReferences, loreSceneOf } from './lore.js'
import { type Memory, coveredUpTo, sceneToSummarise, storySoFar } from './narrative_memory.js'
import { loadOpponents } from './npcs.js'
import { SUMMARISE_QUEUE, type SummariseJob, loadMemory } from './summary_service.js'
import { type NpcDefinition, type WorldDefinition, locationArchetypeReferences } from './world.js'
import {
  OUT_OF_CHARACTER,
  ARBITRATION_SCHEMA,
  ARBITRATION_SYSTEM_PROMPT,
  buildArbitrationMessage,
} from './prompts/arbitration.js'
import { NARRATION_SYSTEM_PROMPT, buildNarrationMessage } from './prompts/narration.js'
import {
  EXTRACTION_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionMessage,
} from './prompts/extraction.js'
import type {
  ArbitrationOutput,
  CombatEngagement,
  GameLanguage,
  NarratedFirstAid,
  NarrationRequest,
  OutcomeToNarrate,
  RecentTurn,
  TurnContext,
  TurnEffects,
} from './prompts/types.js'
import { type ValidationMeta, validateArbitration, validateExtraction } from './turn_validator.js'
import {
  type StoredFailure,
  type TracedFirstAid,
  type TracedEvents,
  type TracedRound,
  type TracedTime,
  type TurnTrace,
  emptyTrace,
  markFailed,
  recordCall,
  traceColumns,
} from './turn_trace.js'

/** The delta of a turn that changes nothing. */
const NO_CHANGE: TurnEffects = {
  movement: null,
  npcs_entered: [],
  npcs_left: [],
  npcs_following: [],
  npc_names: [],
  npc_relations: [],
  scenario_flags: [],
  hit_points_delta: 0,
  items_created: [],
  items_transferred: [],
  items_destroyed: [],
  items_equipped: [],
  items_unequipped: [],
  passages_discovered: [],
  passages_unlocked: [],
  items_discovered: [],
}

/**
 * The language of a turn whose submission names none, set per deployment by
 * `DEFAULT_LANGUAGE` (`config/game.ts`), English when unset. Still passed
 * explicitly at every step rather than hardcoded downstream: the architecture
 * document requires the language to never be assumed fixed.
 */
export const DEFAULT_LANGUAGE: GameLanguage = gameConfig.defaultLanguage

/** The queue turns are played from, one job per turn. */
export const PLAY_TURN_QUEUE = 'play-turn'

/** The job carries the turn's id and nothing else: all state is read from the database. */
export type PlayTurnJob = {
  turnId: string
}

/**
 * What a turn left pending too long is marked with. Its message is the one the
 * player reads back.
 */
const EXPIRED: StoredFailure = {
  code: 'turn_expired',
  message: 'The game master never finished this turn. Try your action again.',
}

export type TurnSubmission = {
  sessionId: string
  /**
   * Whose session it is. The lookup is scoped to it rather than checked
   * afterwards, so someone else's session reads as one that does not exist.
   */
  userId: string
  playerInput: string
  /**
   * Generated by the client, one per submission — not per text. Sending the
   * same submission again (double click, network lost before the answer) reuses
   * it; a retry after a failed turn is a new submission with a new key.
   */
  idempotencyKey: string
  language?: GameLanguage
}

export type SubmittedTurn = {
  turn: TurnLog
  /**
   * The key was already known: the turn it names is returned as it stands, and
   * nothing is played a second time.
   */
  replayed: boolean
}

/**
 * One turn, end to end.
 *
 * Split in two on purpose: `submit` records the turn and queues it, answering
 * the player at once; `run` plays it, in a job. A turn that leaves enough of
 * the story uncovered asks for a summary, written by a job of its own.
 */
export class TurnService {
  #llm: LlmGateway
  #rules: RulesEngine
  #queue: JobQueue
  #events: TurnEvents
  #clock: Clock

  constructor(
    llm: LlmGateway,
    rules: RulesEngine,
    queue: JobQueue,
    events: TurnEvents,
    clock: Clock
  ) {
    this.#llm = llm
    this.#rules = rules
    this.#queue = queue
    this.#events = events
    this.#clock = clock
  }

  /**
   * Records the submission and queues it — unless its key is already known, in
   * which case the existing turn is returned and nothing is queued again.
   *
   * Enqueued after the turn is written, never in the same transaction: BullMQ
   * could not take part in one. A turn that cannot be queued is marked failed
   * at once, since no job will ever pick it up.
   */
  async submit(submission: TurnSubmission): Promise<SubmittedTurn> {
    const recorded = await this.record(submission)

    if (recorded.replayed) {
      return recorded
    }

    try {
      await this.#queue.enqueue<PlayTurnJob>(PLAY_TURN_QUEUE, { turnId: recorded.turn.id })
    } catch (cause) {
      const error = new QueueUnavailableError({ cause })

      await this.#fail(recorded.turn, emptyTrace(), error)

      throw error
    }

    return recorded
  }

  /**
   * Fails every turn still pending since before `cutoff`: its process died
   * mid-turn, or its job was lost. Left alone, it would keep the game screen
   * waiting on a turn nothing will ever finish.
   *
   * Returns the ids it expired.
   */
  async expireStale(cutoff: DateTime): Promise<string[]> {
    const rows: { id: string; session_id: string; idempotency_key: string | null }[] = await db
      .from('turn_log')
      .where('status', 'pending')
      .where('created_at', '<', cutoff.toJSDate())
      .update({ status: 'failed', failure: EXPIRED })
      .returning(['id', 'session_id', 'idempotency_key'])

    /** A screen still waiting on one of these stops waiting now. */
    for (const row of rows) {
      this.#events.emit(
        { turnId: row.id, sessionId: row.session_id, idempotencyKey: row.idempotency_key },
        { type: 'turn_failed', failure: { code: EXPIRED.code, message: EXPIRED.message } }
      )
    }

    return rows.map((row) => row.id)
  }

  /**
   * Records a submitted turn as pending, before anything is played: recording
   * it only at the end would let a repeated submission through for the whole
   * time the model takes to answer.
   */
  async record(submission: TurnSubmission): Promise<SubmittedTurn> {
    return db.transaction(async (trx) => {
      /** Under the game's lock: abandoning it waits for this, and this for it. */
      const session = await lockOwnGame(submission.sessionId, submission.userId, trx)

      /**
       * `ON CONFLICT DO NOTHING` rather than catching the unique violation: in
       * PostgreSQL a failed insert aborts the surrounding transaction, and the
       * lookup that follows would fail with it.
       */
      const existing = await TurnLog.query({ client: trx })
        .where('sessionId', session.id)
        .where('idempotencyKey', submission.idempotencyKey)
        .first()

      /** A repeated submission gets its turn as it stands, even once the game is over. */
      if (existing) {
        return { turn: existing, replayed: true }
      }

      if (!isOngoing(session)) {
        throw new GameEndedError()
      }

      const [inserted] = await trx
        .table('turn_log')
        .insert({
          session_id: session.id,
          idempotency_key: submission.idempotencyKey,
          status: 'pending',
          player_input: submission.playerInput,
          language: submission.language ?? DEFAULT_LANGUAGE,
          created_at: new Date(),
        })
        .onConflict(['session_id', 'idempotency_key'])
        .ignore()
        .returning('id')

      if (inserted) {
        return { turn: await TurnLog.findOrFail(inserted.id, { client: trx }), replayed: false }
      }

      const raced = await TurnLog.query({ client: trx })
        .where('sessionId', session.id)
        .where('idempotencyKey', submission.idempotencyKey)
        .firstOrFail()

      return { turn: raced, replayed: true }
    })
  }

  /**
   * Plays a pending turn. Takes only its id and reads everything else from the
   * database, which is all a queued job will carry.
   */
  async run(turnId: string): Promise<TurnLog> {
    const turn = await TurnLog.findOrFail(turnId)

    if (turn.status !== 'pending') {
      throw new Error(`Turn ${turnId} is ${turn.status}: only a pending turn can be played.`)
    }

    /** Counted from here, when a worker picks the turn up — not from its submission. */
    const budget = new TurnBudget(this.#clock)
    /**
     * The world is read here, once, with the rest of the scene: every step of
     * this turn sees the same content, whatever is edited while it plays.
     */
    const scene = await this.#loadScene(turn.sessionId)

    /**
     * Filled as the pipeline progresses, so a turn that dies halfway still
     * leaves behind everything it had managed to produce.
     */
    const trace = emptyTrace()

    try {
      const effects = await this.#runPipeline(turn, scene, trace, budget)

      await this.#complete(turn, scene, trace, effects)
    } catch (error) {
      /**
       * The log of a failed turn is what makes the failure debuggable at all,
       * so it is written before the error is re-thrown — and its own failure is
       * swallowed rather than allowed to mask the real one.
       */
      await this.#fail(turn, trace, error).catch(() => {})

      throw error
    }

    /** After the commit: the player is never told of a turn that could still roll back. */
    const labels = new ContentLabels(scene.world, turn.language)
    this.#events.emit(refOf(turn), {
      type: 'turn_completed',
      turn,
      character: scene.character,
      characterState: scene.characterState,
      inventory: await characterItems(scene.session.id, scene.character.id),
      location: await this.#whereItStands(scene.worldState),
      period: periodAt(scene.worldState.gameTime),
      labels,
      opponents: await loadOpponents(
        scene.session,
        scene.world,
        labels,
        scene.worldState.knownNpcs
      ),
    })

    await this.#requestSummary(scene, turn.turnNumber!)

    return turn
  }

  /**
   * Queues a summary once enough turns go uncovered: written off this turn's
   * path, in a queue of its own, so it never delays anyone's next turn.
   * Failing to queue it never fails the turn — the next one asks again.
   */
  async #requestSummary(scene: LoadedScene, lastTurn: number): Promise<void> {
    if (sceneToSummarise(scene.memory, lastTurn) === null) {
      return
    }

    await this.#queue
      .enqueue<SummariseJob>(SUMMARISE_QUEUE, { sessionId: scene.session.id })
      .catch(() => {})
  }

  /**
   * Marks the turn failed and tells the player — unless it was already
   * settled, by the sweep most likely, which has told them already. Exactly one
   * terminal event per turn.
   */
  async #fail(turn: TurnLog, trace: TurnTrace, error: unknown): Promise<void> {
    const failure = await markFailed(turn.id, trace, error)

    if (failure) {
      this.#events.emit(refOf(turn), {
        type: 'turn_failed',
        failure: { code: failure.code, message: failure.message },
      })
    }
  }

  /**
   * The separated pipeline: arbitration (A+B+C), the roll when one is needed,
   * narration (D), extraction (E). Three model calls at least, whichever way
   * arbitration rules. Each step writes its part of the trace as it goes, so
   * a turn that fails halfway still logs every step it played.
   *
   * Returns the delta extraction read in the narration, validated but not yet
   * applied: applying it belongs to the turn's transaction.
   */
  async #runPipeline(
    turn: TurnLog,
    scene: LoadedScene,
    trace: TurnTrace,
    budget: TurnBudget
  ): Promise<TurnEffects> {
    const { world } = scene
    const context = buildContext(scene, turn.playerInput, turn.language)
    /** The world's own list, from the snapshot the turn was picked up with. */
    const actionTypes = actionTypesOf(world)
    const movement = movementOptionsOf(scene)
    const clock = { gameTime: scene.worldState.gameTime, stopped: scene.stopped }
    const progressOf = progressReader(scene.eventRows)
    /** Someone waiting in a place — from the start, or by their schedule — comes into a scene only there, or within reach. */
    const npcDefinitions = enterableNpcs(
      world,
      scene.metNpcs,
      new Set([...(scene.here === null ? [] : [scene.here]), ...movement.destinations]),
      clock
    )
    /** What the character knows is coming, and whom they know to come and go. */
    const foreseeable = foreseeableEvents(world.events, progressOf, scene.snapshot)
    const awaitable = scheduledNpcs(world, scene.stopped).filter(({ reference }) =>
      scene.worldState.knownNpcs.includes(reference)
    )
    const meta: ValidationMeta = {
      actionTypes: actionTypes.map(({ actionType }) => actionType),
      npcHandles: scene.npcs.map(({ handle }) => handle),
      locations: movement.destinations,
      locationArchetypes: movement.archetypes,
      parentLocations: movement.parents,
      hiddenExits: scene.exits.filter(({ hidden }) => hidden).map(({ to }) => to),
      lockedExits: scene.exits.filter(({ locked }) => locked).map(({ to }) => to),
      destinationsAfter: movement.after,
      npcDefinitions,
      npcArchetypes: world.npcs
        .filter(({ kind }) => kind === 'archetype')
        .map(({ reference }) => reference),
      itemsInScene: itemReferencesOf(scene.items),
      sceneItems: sceneItemsOf(scene.items),
      hiddenItems: scene.items.location
        .filter(({ hidden, handle }) => hidden && handle !== null)
        .map(({ handle }) => handle!),
      creatableItems: scene.creatableItems,
      itemKinds: world.items.map((item) => ({
        reference: item.reference,
        unique: item.kind === 'unique',
        stackable: item.kind === 'archetype' && item.stackable,
        equippable: item.equippable,
      })),
      reachableLocations: scene.routes.map(({ to }) => to),
      hasLocation: scene.worldState.currentLocationId !== null,
      hitPointsMax: scene.characterState.hitPointsMax,
      /** One set already sets nothing: refusing it would only cost a second call. */
      flags: world.flags.map(({ reference }) => reference),
      foreseeableEvents: foreseeable.map(({ reference }) => reference),
      awaitableNpcs: awaitable.map(({ reference }) => reference),
    }
    const step = { trace, budget }

    /** Picked by the scene as the turn began, never by the player's text. */
    const arbitrationLore = loreFor(world, 'arbitration', loreSceneOf(world, context.scene))
    trace.lore.arbitration = loreReferences(arbitrationLore)

    const decision = await this.#arbitrate(
      turn,
      buildArbitrationMessage({
        ...context,
        action_types: actionTypes,
        lore: arbitrationLore,
        world_events: scene.recentEvents.map(({ description }) => description),
        foreseeable_events: foreseeable.map(({ reference, description }) => ({
          reference,
          description,
        })),
        awaitable_npcs: awaitable.map(({ reference, label }) => ({ reference, label })),
      }),
      meta,
      step
    )
    const { outcome, resolution } = this.#settle(scene, decision, trace)
    const aside = decision.intent.type === OUT_OF_CHARACTER
    const round = await this.#fight(scene, decision, resolution, trace)
    trace.firstAid = this.#tend(scene, decision, outcome)
    await this.#announceRolls(turn, scene, resolution, trace.combat)
    /** A round of combat is fought where it stands: nobody walks away mid-blow. */
    const route = aside || round !== null ? null : routeTo(scene, decision.intent.destination)
    /** The clock of the turn, cut short by what the character sees happen, or ended by what they waited for. */
    const timing = planTime(scene, decision, aside, route, round)
    const time = timing.time
    trace.time = time
    /** Whoever comes where the character is, brought by an event or their schedule. */
    const arriving = await this.#arriving(scene, timing, trace.combat)
    trace.events = {
      timed: timing.due.map((due) => ({
        event: due.event.reference,
        at: due.at,
        outcome: due.outcome,
        witnessed: due.outcome === 'fired' && witnesses(due.event, timing.around),
      })),
      state: [],
      told: aside ? [] : scene.untold.map(({ reference }) => reference),
      interrupted: timing.interrupted,
      awaited: timing.awaited,
      deferred: [],
    }
    /**
     * The opponent the round brought in counts as present from here on:
     * narrated, then read — and so does whoever arrives during the turn.
     */
    const present = withArrivals(withOpponent(context, trace.combat, world), arriving)
    for (const { definition } of arriving) {
      if (!npcDefinitions.includes(definition)) npcDefinitions.push(definition)
    }
    /** Whoever was left where the character goes, or waits there, is there to meet them. */
    const waiting =
      route === null
        ? []
        : [
            ...(await npcsWaitingIn(scene.session.id, route.to)),
            ...(await npcsPlacedIn(world, scene.session.id, route.to, undefined, {
              gameTime: time.after,
              stopped: scene.stopped,
            })),
          ].filter(({ handle }) => !arriving.some((npc) => npc.handle === handle))
    /** Staging an arrival calls for the lore of where it ends, and of who waits there. */
    const narrationLore = loreFor(
      world,
      'narration',
      loreSceneOf(
        world,
        context.scene,
        route === null
          ? null
          : { destination: route.to, npcs: waiting.map(({ definition }) => definition) }
      )
    )
    trace.lore.narration = loreReferences(narrationLore)
    const narration = await this.#narrate(
      turn,
      buildNarrationMessage({
        ...withOpponent(context, trace.combat, world),
        /** A verdict and a qualitative degree. Never the dice or the chance. */
        outcome,
        /** The round in labels: landed or not, how it was met, how badly it wounded. */
        combat: round === null ? null : narratedRound(round),
        first_aid: narratedFirstAid(trace.firstAid),
        game_time_after: time.after,
        route,
        npcs_at_destination: waiting,
        npcs_arriving: arriving,
        npcs_leaving: timing.leaving,
        activities: activitiesOf(scene, present.scene.npcs_present, timing),
        place_notes_after: notesOf(
          world,
          route === null
            ? (scene.worldState.currentLocation ?? null)
            : { definitionReference: route.to },
          route === null ? scene.placeNote : null,
          time.after
        ),
        world_events: [
          ...scene.untold.map(({ description }) => ({ description, when: 'earlier' as const })),
          ...timing.due
            .filter((due) => due.outcome === 'fired' && witnesses(due.event, timing.around))
            .map(({ event }) => ({ description: event.description, when: 'now' as const })),
        ],
        interrupted: interruptionText(world, timing),
        awaited:
          timing.awaited === null ? null : timing.awaited.arrived ? 'arrived' : 'did_not_happen',
        intent_summary: decision.intent.summary,
        aside,
        lore: narrationLore,
      }),
      trace,
      budget
    )

    /**
     * An aside to the game master changes nothing: the backend decides so,
     * rather than trusting extraction to read nothing into the answer.
     */
    if (aside) {
      return NO_CHANGE
    }

    if (trace.combat?.provisional) {
      meta.npcHandles = [...meta.npcHandles, trace.combat.opponent]
    }
    meta.npcHandles = [
      ...meta.npcHandles,
      ...arriving.map(({ handle }) => handle).filter((handle) => !meta.npcHandles.includes(handle)),
    ]

    return this.#extract(
      buildExtractionMessage({
        ...present,
        narration,
        creatable_items: scene.creatableItems,
        enterable_npcs: npcDefinitions,
        flags: world.flags.filter(({ reference }) => !scene.snapshot.flags.has(reference)),
        movement: {
          destinations: movement.destinations,
          archetypes: movement.archetypes,
          parents: movement.parents,
        },
      }),
      meta,
      step
    )
  }

  /**
   * Who comes where the character is during the turn, under the handle they
   * will have once the turn applies: whoever an event the character sees
   * brings there, and whoever their schedule does. A person of an archetype
   * is numbered in the order the backend will create them — after the
   * opponent a round brought in.
   */
  async #arriving(
    scene: LoadedScene,
    timing: TurnTiming,
    round: TracedRound | null
  ): Promise<NarrationRequest['npcs_arriving']> {
    const { world } = scene
    const place = timing.place
    const arriving: NarrationRequest['npcs_arriving'] = []

    if (place === null) {
      return arriving
    }

    const known = new Set(scene.npcs.map(({ handle }) => handle))
    const numbered = new Map<string, number>()
    const nextOf = async (definition: string) => {
      const first = await nextHandleOf(scene.session.id, definition)
      const next =
        numbered.get(definition) ??
        Number(first.split('_').pop()) + (round?.provisional?.definition === definition ? 1 : 0)
      numbered.set(definition, next + 1)

      return `${definition}_${next}`
    }
    const unique = async (reference: string, activity: string | null) => {
      const npc = scene.snapshot.npcs.get(reference)
      const definition = world.npcs.find((entry) => entry.reference === reference)

      if (known.has(reference) || npc?.status === 'dead' || definition === undefined) {
        return
      }

      const instance =
        npc === undefined
          ? null
          : await NpcInstance.query()
              .where('sessionId', scene.session.id)
              .where('handle', reference)
              .first()
      known.add(reference)
      arriving.push({
        handle: reference,
        name: instance?.name ?? null,
        descriptor: instance?.descriptor ?? null,
        disposition: npc?.disposition ?? definition.defaultDisposition,
        condition: 'standing',
        definition: reference,
        activity,
      })
    }

    for (const { event, outcome } of timing.due) {
      if (outcome !== 'fired') continue

      for (const effect of event.effects) {
        if (effect.type !== 'npc_entered' && effect.type !== 'npc_moved') continue

        const definition = world.npcs.find(({ reference }) => reference === effect.npc)
        const created =
          definition?.kind === 'archetype' && scene.snapshot.visited.has(effect.location)

        if (effect.location !== place) {
          /** Elsewhere, a new person still takes their number. */
          if (created) await nextOf(effect.npc)
          continue
        }

        if (definition?.kind === 'archetype') {
          arriving.push({
            handle: await nextOf(effect.npc),
            name: null,
            descriptor: effect.type === 'npc_entered' ? effect.descriptor : null,
            disposition: definition.defaultDisposition,
            condition: 'standing',
            definition: effect.npc,
            activity: null,
          })
        } else {
          await unique(effect.npc, null)
        }
      }
    }

    for (const { npc, activity } of timing.arrivals) {
      await unique(npc.reference, activity)
    }

    return arriving
  }

  /**
   * It rules, and only rules: the outcome is staged by the narration step
   * whichever way it went. A refused output gets one more attempt; a
   * transport failure gets none.
   */
  async #arbitrate(
    turn: TurnLog,
    userMessage: string,
    meta: ValidationMeta,
    step: { trace: TurnTrace; budget: TurnBudget }
  ): Promise<ArbitrationOutput> {
    this.#events.emit(refOf(turn), { type: 'step_started', step: 'arbitration' })

    const decision = await callStructured(
      this.#llm,
      {
        step: 'arbitration',
        systemPrompt: ARBITRATION_SYSTEM_PROMPT,
        userMessage,
        jsonSchema: ARBITRATION_SCHEMA as unknown as Record<string, unknown>,
        validate: (payload) => validateArbitration(payload, meta),
      },
      step
    )
    step.trace.arbitration = decision

    return decision
  }

  /**
   * Reads the narration already written. A refused output gets one more
   * attempt, which never reruns the narration. No milestone of its own: the
   * narration on screen stays provisional until the turn completes.
   */
  async #extract(
    userMessage: string,
    meta: ValidationMeta,
    step: { trace: TurnTrace; budget: TurnBudget }
  ): Promise<TurnEffects> {
    const effects = await callStructured(
      this.#llm,
      {
        step: 'extraction',
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        userMessage,
        jsonSchema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
        validate: (payload) => validateExtraction(payload, meta),
      },
      step
    )
    step.trace.extraction = effects as unknown as Record<string, unknown>

    return effects
  }

  /**
   * Free text, sent to the player fragment by fragment as it is written.
   * Nothing of it is stored until the turn completes: the fragments are
   * provisional, and the text persisted is exactly their concatenation.
   *
   * Free text, so there is nothing to validate and no second attempt: an
   * empty answer or a cut stream fails the turn like any transport failure.
   */
  async #narrate(
    turn: TurnLog,
    userMessage: string,
    trace: TurnTrace,
    budget: TurnBudget
  ): Promise<string> {
    this.#events.emit(refOf(turn), { type: 'step_started', step: 'narration' })

    const stream = this.#llm.streamText('narration', {
      systemPrompt: NARRATION_SYSTEM_PROMPT,
      userMessage,
      signal: budget.signalFor('narration', this.#llm.provider),
    })

    let narration = ''
    let next = await stream.next()

    while (!next.done) {
      narration += next.value
      this.#events.emit(refOf(turn), { type: 'narration_chunk', text: next.value })
      next = await stream.next()
    }

    recordCall(trace, next.value)
    trace.narration = narration

    return narration
  }

  /**
   * The outcome arbitration's ruling leads to. A roll is made by the backend
   * alone, on the skill or characteristic `resolution_rules` ties to the
   * chosen action type — a skill never trained at its base chance —
   * with the circumstances arbitration labelled and the modifiers of the
   * items the character holds; without a roll, the outcome was certain from
   * the start. Announced once the round, if any, has been fought: the
   * player sees what their attack dealt with the roll itself.
   */
  #settle(
    scene: LoadedScene,
    decision: ArbitrationOutput,
    trace: TurnTrace
  ): { outcome: OutcomeToNarrate; resolution: RollResolution | null } {
    const { mode, action_type: actionType, difficulty } = decision.resolution

    if (mode !== 'roll_required') {
      return {
        outcome: {
          mode,
          result: mode === 'automatic_success' ? 'success' : 'failure',
          degree: null,
          reason: mode === 'narrative_automatic_failure' ? decision.validity.justification : null,
        },
        resolution: null,
      }
    }

    const base = rollBaseFor(scene.world, resolutionFor(scene.world, actionType!), scene.character)
    const resolution = this.#rules.resolve(base, difficulty!, {
      contextual: decision.resolution.contextual_modifiers,
      /** The character's own, never what someone else or the place holds. */
      items: modifierSources(scene.world, scene.items.character),
    })

    /** Every modifier with its origin, contextual and item side by side, for the log. */
    trace.roll = { actionType: actionType!, ...resolution }

    return { outcome: { mode, ...toNarrationOutcome(resolution), reason: null }, resolution }
  }

  /**
   * A round of combat, when arbitration declared one: the character's blow
   * — the roll just made, on an attacking category — then the riposte, both
   * worked out by the backend. An archetype attacked before anyone wrote them
   * in is fought under the handle the turn will bring them in with.
   */
  async #fight(
    scene: LoadedScene,
    decision: ArbitrationOutput,
    resolution: RollResolution | null,
    trace: TurnTrace
  ): Promise<Round | null> {
    const engagement = decision.combat

    if (engagement === null) {
      return null
    }

    const { opponent, provisional } = await this.#opponentOf(scene, engagement)
    const round = playRound(this.#rules, {
      others: await this.#otherHostiles(scene, opponent.handle),
      world: scene.world,
      character: {
        characteristics: scene.character.characteristics,
        skills: scene.character.skills,
        hitPoints: scene.characterState.hitPoints,
        hitPointsMax: scene.characterState.hitPointsMax,
        bleeding: scene.characterState.bleeding,
      },
      characterItems: scene.items.character,
      opponent,
      engagement,
      attack:
        engagement.character_attacks && resolution !== null
          ? { actionType: decision.resolution.action_type!, resolution }
          : null,
    })
    trace.combat = { ...round, provisional }

    return round
  }

  async #opponentOf(
    scene: LoadedScene,
    engagement: CombatEngagement
  ): Promise<{ opponent: Opponent; provisional: { definition: string } | null }> {
    if (scene.npcs.some(({ handle }) => handle === engagement.opponent)) {
      const [opponent] = await this.#presentOpponents(scene, [engagement.opponent])

      return { opponent, provisional: null }
    }

    const definition = npcDefinitionOf(scene.world, engagement.opponent)

    return {
      opponent: {
        handle: await nextHandleOf(scene.session.id, definition.reference),
        definition,
        hitPoints: definition.combat.hitPointsMax,
        bleeding: false,
        dying: false,
        items: [],
      },
      provisional: { definition: definition.reference },
    }
  }

  /**
   * The hostile people present and standing, but the opponent: any of them
   * may strike back in the round, in the opponent's place.
   */
  async #otherHostiles(scene: LoadedScene, opponent: string): Promise<Opponent[]> {
    const handles = scene.npcs
      .filter(
        ({ handle, disposition, condition }) =>
          handle !== opponent && disposition === 'hostile' && condition === 'standing'
      )
      .map(({ handle }) => handle)

    return handles.length === 0 ? [] : this.#presentOpponents(scene, handles)
  }

  /** People present as a round reads them, in the order given: hit points, wounds, what they hold. */
  async #presentOpponents(scene: LoadedScene, handles: string[]): Promise<Opponent[]> {
    const instances = await NpcInstance.query()
      .where('sessionId', scene.session.id)
      .whereIn('handle', handles)
    const byHandle = new Map(instances.map((instance) => [instance.handle, instance]))

    return handles.map((handle) => {
      const instance = byHandle.get(handle)

      if (instance === undefined) {
        throw new Error(`No one in session ${scene.session.id} goes by "${handle}".`)
      }

      const definition = npcDefinitionOf(scene.world, instance.definitionReference)

      return {
        handle,
        definition,
        hitPoints: instance.hitPoints ?? definition.combat.hitPointsMax,
        bleeding: instance.bleeding,
        dying: instance.status === 'dying',
        items: scene.items.npcs.find((npc) => npc.handle === handle)?.items ?? [],
      }
    })
  }

  /**
   * First aid, when the action is one: on the character, or on the person it
   * is aimed at. Its effect is the backend's, by the degree — or by the
   * outcome when no roll was needed; a wound already tended gets nothing
   * more.
   */
  #tend(
    scene: LoadedScene,
    decision: ArbitrationOutput,
    outcome: OutcomeToNarrate
  ): TracedFirstAid | null {
    if (
      decision.resolution.action_type !== FIRST_AID ||
      decision.intent.type === OUT_OF_CHARACTER
    ) {
      return null
    }

    const target = decision.intent.target
    const available =
      target === null
        ? scene.characterState.firstAidAvailable
        : scene.npcs.find(({ handle }) => handle === target) !== undefined &&
          scene.tendable.has(target)
    const degree = outcome.degree ?? (outcome.result === 'success' ? 'success' : 'failure')
    const healed = available ? this.#rules.firstAid(degree) : 0

    return {
      target,
      degree,
      available,
      healed,
      saved: available && (degree === 'success' || degree === 'special' || degree === 'critical'),
    }
  }

  /**
   * The character's rolls, one event each, in the order they were made: their
   * action or attack — with what it dealt — then their defence. The people's
   * rolls are never sent.
   */
  async #announceRolls(
    turn: TurnLog,
    scene: LoadedScene,
    action: RollResolution | null,
    round: TracedRound | null
  ): Promise<void> {
    const labels = new ContentLabels(scene.world, turn.language)
    const opponents = await loadOpponents(
      scene.session,
      scene.world,
      labels,
      scene.worldState.knownNpcs
    )

    for (const { resolution, combat } of characterRolls(action, round, opponents)) {
      this.#events.emit(refOf(turn), { type: 'roll_resolved', resolution, combat, labels })
    }
  }

  /** The place the game stands in once the turn is applied, for the badge the front shows. */
  async #whereItStands(worldState: WorldState): Promise<LocationInstance | null> {
    return worldState.currentLocationId === null
      ? null
      : LocationInstance.find(worldState.currentLocationId)
  }

  /**
   * Ownership was checked when the turn was recorded: from here on, the turn
   * is all there is to go on.
   */
  async #loadScene(sessionId: string): Promise<LoadedScene> {
    const session = await Session.query()
      .where('id', sessionId)
      .preload('character', (character) => character.preload('profession'))
      .preload('characterState')
      .preload('worldState', (worldState) => worldState.preload('currentLocation'))
      .preload('locations', (locations) => locations.orderBy('createdAt', 'asc'))
      .firstOrFail()

    const world = await loadWorld(session)

    const { character, characterState } = session

    if (!characterState) {
      throw new Error(`Session ${sessionId} has no state for its character.`)
    }

    const items = await itemsInScene(sessionId, {
      characterId: character.id,
      locationInstanceId: session.worldState.currentLocationId,
    })
    const place = session.worldState.currentLocation ?? null
    const here = uniqueReferenceOf(world, place)
    const travel: TravelState = {
      visited: new Set(
        session.locations
          .map(({ definitionReference }) => definitionReference)
          .filter((reference) => uniqueReferenceOf(world, { definitionReference: reference }))
      ),
      passages: await passageStates(sessionId),
      held: new Set(items.character.map(({ definition }) => definition)),
      guarded: await guardedPlaces(sessionId),
      /** A passage the time of day shuts is shut for the whole turn. */
      period: periodAt(session.worldState.gameTime),
    }

    /** What the scenario's events did so far, and what their conditions read. */
    const eventRows = await loadProgress(sessionId)
    const snapshot = await loadSnapshot(world, sessionId, session.worldState)

    const memory = await loadMemory(sessionId)
    /** Who in the scene has a wound first aid can still see to. */
    const tendable = await NpcInstance.query()
      .where('sessionId', sessionId)
      .whereIn('status', ['present', 'dying'])
      .where('firstAidAvailable', true)

    /**
     * Every turn after the last one a summary covers, so none is ever missing
     * from both — at least the last few, since a summary never takes them.
     * Completed turns only: a failed turn is not part of the story, and
     * handing the model an action that never happened would have it narrate
     * around it.
     */
    const turns = await TurnLog.query()
      .where('sessionId', sessionId)
      .withScopes((scopes) => scopes.completed())
      .where('turnNumber', '>', coveredUpTo(memory))
      .orderBy('turnNumber', 'asc')

    /** Only completed turns hold a number, so the highest one is the last of the story. */
    const last = await TurnLog.query()
      .where('sessionId', sessionId)
      .max('turn_number as max')
      .first()

    return {
      session,
      world,
      character,
      characterState,
      worldState: session.worldState,
      npcs: await presentNpcs(sessionId),
      npcDefinitions: await presentNpcDefinitions(sessionId),
      metNpcs: await metNpcs(sessionId),
      tendable: new Set(tendable.map(({ handle }) => handle)),
      items,
      creatableItems: await creatableItems(world, sessionId),
      here,
      travel,
      ...describePlace(world, place),
      exits: here === null ? [] : exitsOf(world.locations, here, travel),
      routes: here === null ? [] : [...routesFrom(world.locations, here, travel).values()],
      eventRows,
      snapshot,
      stopped: stoppedSchedules(world, eventRows),
      placeNote: here === null ? null : await placeNoteOf(sessionId, here),
      untold: untoldEvents(world, eventRows),
      recentEvents: eventsSince(world, eventRows, coveredUpTo(memory)),
      around: placesAround(world, place),
      memory,
      /** Oldest first, so the model reads the exchange in the order it happened. */
      recentTurns: turns,
      lastTurnNumber: Number(last?.$extras.max ?? 0),
    }
  }

  /**
   * State change and turn log land together: a state that moved without a log
   * entry explaining it would be impossible to reconstruct afterwards.
   *
   * The turn gets its number here, and only here: a number is a place in the
   * story, which a turn earns by completing.
   */
  async #complete(
    turn: TurnLog,
    scene: LoadedScene,
    trace: TurnTrace,
    effects: TurnEffects
  ): Promise<void> {
    const turnNumber = scene.lastTurnNumber + 1

    try {
      await db.transaction(async (trx) => {
        /**
         * Locked and re-read: the sweep may have expired this turn while the
         * model was answering. Its outcome is then settled, and must not be
         * overwritten — nor its effects applied.
         */
        const current = await TurnLog.query({ client: trx })
          .where('id', turn.id)
          .forUpdate()
          .firstOrFail()

        if (current.status !== 'pending') {
          throw new StaleTurnError(turn.id)
        }

        /** The clock moves with the rest of the state, or not at all. */
        if (trace.time !== null) {
          scene.worldState.gameTime = trace.time.after
        }

        const hitPointsBefore = scene.characterState.hitPoints
        const aside = trace.arbitration?.intent.type === OUT_OF_CHARACTER
        const combat = {
          world: scene.world,
          sessionId: scene.session.id,
          characterState: scene.characterState,
          placeId: scene.worldState.currentLocationId,
        }

        /**
         * Those who fell dying in an earlier turn die now, unless tended in
         * this one; then the round, then first aid — before the delta, whose
         * extraction already saw the opponent the round brought in.
         */
        if (!aside) {
          await letTheDyingDie(combat, trace.firstAid?.saved ? trace.firstAid.target : null, trx)
        }
        if (trace.combat !== null) {
          await applyRound(combat, trace.combat, trx)
        }
        if (trace.firstAid !== null) {
          await applyFirstAid(combat, trace.firstAid, trx)
        }

        const events = {
          world: scene.world,
          sessionId: scene.session.id,
          worldState: scene.worldState,
          characterId: scene.character.id,
          placeId: scene.worldState.currentLocationId,
          harm: { rules: this.#rules, characterState: scene.characterState },
        }

        /**
         * What the clock brought, in the order it fell — before the delta,
         * whose extraction already saw whoever it brought in.
         */
        if (!aside && trace.events !== null) {
          await this.#settleTimedEvents(events, trace.events, turnNumber, trx)
        }

        const applied = await applyDelta(
          {
            world: scene.world,
            sessionId: scene.session.id,
            characterState: scene.characterState,
            worldState: scene.worldState,
            here: scene.here,
            travel: scene.travel,
          },
          /** In a round, the blows are the backend's: what extraction reads of them counts for nothing. */
          trace.combat === null ? effects : { ...effects, hit_points_delta: 0 },
          trx
        )

        if (!aside) {
          if (trace.combat === null) {
            await stopBleeding(combat, trx)
          }
          await heal(
            this.#rules,
            scene.characterState,
            { after: scene.worldState.gameTime },
            applied.hit_points_delta < 0,
            trx
          )

          if (trace.events !== null) {
            await this.#settleTheWorld(scene, events, trace.events, turnNumber, trx)
          }
        }

        scene.session.lastActivityAt = DateTime.now()
        await scene.session.useTransaction(trx).save()

        turn.merge({
          ...traceColumns(trace),
          status: 'completed',
          turnNumber,
          /**
           * As applied, which is what the player is shown — not as proposed:
           * the hit points the turn moved in all, blows, care and time included.
           */
          appliedEffects: {
            ...applied,
            hit_points_delta: scene.characterState.hitPoints - hitPointsBefore,
          },
        })

        await turn.useTransaction(trx).save()
      })
    } catch (error) {
      /**
       * Another request reached this turn number first. The transaction rolled
       * back, so nothing of this turn was applied.
       */
      if (isTurnNumberConflict(error)) {
        throw new ConcurrentTurnError(turnNumber)
      }

      throw error
    }
  }

  /** The timed events of the turn, as planned: each recorded, and set off unless cancelled. */
  async #settleTimedEvents(
    target: EventsTarget,
    events: TracedEvents,
    turnNumber: number,
    trx: TransactionClientContract
  ): Promise<void> {
    for (const timed of events.timed) {
      const event = target.world.events.find(({ reference }) => reference === timed.event)

      if (event === undefined) {
        continue
      }

      if (timed.outcome === 'cancelled') {
        await recordEvent(
          target.sessionId,
          event.reference,
          { cancelledAt: timed.at, turnNumber },
          trx
        )
        continue
      }

      await recordEvent(
        target.sessionId,
        event.reference,
        {
          firedAt: timed.at,
          turnNumber,
          witnessed: timed.witnessed,
          /** Seen, it was just narrated. */
          told: timed.witnessed,
        },
        trx
      )
      const harm = await applyEvent(target, event, timed.witnessed, trx)
      if (harm.length > 0) timed.harm = harm
    }
  }

  /**
   * The world once the turn applied: what the state now sets off, then where
   * the schedules put people — whoever ends where the character stands is
   * there to meet them. The events told this turn are told for good.
   */
  async #settleTheWorld(
    scene: LoadedScene,
    target: EventsTarget,
    events: TracedEvents,
    turnNumber: number,
    trx: TransactionClientContract
  ): Promise<void> {
    const { world, worldState } = scene
    const placeId = worldState.currentLocationId
    const place = placeId === null ? null : await LocationInstance.find(placeId, { client: trx })
    const around = placesAround(world, place)

    const { settled, deferred } = await settleStateEvents(
      { ...target, placeId },
      { gameTime: worldState.gameTime, turnNumber, around: async () => around },
      trx
    )
    events.state = settled
    events.deferred = deferred

    await followSchedules(
      {
        world,
        sessionId: scene.session.id,
        place: place === null ? null : { id: place.id, reference: uniqueReferenceOf(world, place) },
      },
      {
        gameTime: worldState.gameTime,
        stopped: stoppedSchedules(world, await loadProgress(scene.session.id, trx)),
      },
      trx
    )
    if (place !== null) {
      await meetThoseWaiting(scene.session.id, place.id, trx)
    }

    await markTold(scene.session.id, events.told, trx)
    await worldState.useTransaction(trx).save()
  }
}

type EventsTarget = {
  world: WorldDefinition
  sessionId: string
  worldState: WorldState
  characterId: string
  placeId: string | null
  harm: { rules: RulesEngine; characterState: CharacterState }
}

type LoadedScene = {
  session: Session
  /** The world as it stood when the turn was picked up. */
  world: WorldDefinition
  /** The sheet, with their profession: what they are and what they can do. */
  character: Character
  /** What they live through in this game: hit points, wounds, resources. */
  characterState: CharacterState
  worldState: WorldState
  npcs: PresentNpc[]
  /** Definition of each person present, by handle. */
  npcDefinitions: Record<string, string>
  /** The definitions of everyone the game has met: who may come back from anywhere. */
  metNpcs: Set<string>
  /** Handles of the people of the scene with a wound not tended yet. */
  tendable: Set<string>
  items: ItemsInScene
  creatableItems: string[]
  /** The named place the scene stands in; null for an improvised one. */
  here: string | null
  /** What decides which ways the character can take. */
  travel: TravelState
  placeDescription: string | null
  surroundings: string | null
  /** The ways out of where the scene stands: none outside a network. */
  exits: SceneExit[]
  /** The places those ways reach, each by its quickest way. */
  routes: Route[]
  /** What became of each event the game armed, set off or saw cancelled, by reference. */
  eventRows: Map<string, EventState>
  /** What the conditions of the events read of the game as the turn began. */
  snapshot: WorldSnapshot
  /** The unique people whose schedule an event stopped. */
  stopped: Set<string>
  /** The note an event left on the named place the scene stands in, if any. */
  placeNote: string | null
  /** The events of the state set off at the end of the last turn before the character, not told yet. */
  untold: ScenarioEvent[]
  /** The events that fell since the last turn a summary covers: facts for arbitration. */
  recentEvents: ScenarioEvent[]
  /** The place the scene stands in, then every place containing it. */
  around: string[]
  /** The summaries the game has, which the turns below follow on from. */
  memory: Memory
  /**
   * Every turn no summary covers, as the narrator reads them; arbitration
   * keeps only the last of them.
   */
  recentTurns: TurnLog[]
  lastTurnNumber: number
}

function buildContext(
  scene: LoadedScene,
  playerInput: string,
  language: GameLanguage
): TurnContext {
  return {
    world: scene.world,
    character: {
      name: scene.character.name,
      gender: scene.character.gender,
      profession: scene.character.profession.reference,
      hit_points: scene.characterState.hitPoints,
      hit_points_max: scene.characterState.hitPointsMax,
    },
    scene: {
      location: scene.worldState.currentLocation?.handle ?? null,
      npcs_present: scene.npcs,
      narrative_flags: scene.worldState.narrativeFlags,
      visited_locations: scene.session.locations.map((location) => location.handle),
      place: scene.worldState.currentLocation ?? null,
      npc_definitions: scene.npcDefinitions,
      known_npcs: scene.worldState.knownNpcs,
      items: scene.items,
      game_time: scene.worldState.gameTime,
      start_date: scene.worldState.startDate,
      place_description: scene.placeDescription,
      surroundings: scene.surroundings,
      place_notes: notesOf(
        scene.world,
        scene.worldState.currentLocation ?? null,
        scene.placeNote,
        scene.worldState.gameTime
      ),
      exits: scene.exits,
      routes: scene.routes,
    },
    story_so_far: storySoFar(scene.memory),
    recent_buffer: toRecentBuffer(scene.recentTurns),
    player_input: playerInput,
    language,
  }
}

/** The definitions of the items that moved a roll: which, never by how much. */
/** Every way an item of the scene can be named: its definition, and its handle if it has one. */
function itemReferencesOf(items: ItemsInScene): string[] {
  const held = [...items.character, ...items.npcs.flatMap((npc) => npc.items), ...items.location]

  return [
    ...new Set(
      held.flatMap(({ definition, handle }) => (handle ? [definition, handle] : [definition]))
    ),
  ]
}

/** The clock of a turn, and what happens in the world while it runs. */
type TurnTiming = {
  time: TracedTime
  /** The timed events the turn's clock brings, in the order they fall. */
  due: DueEvent[]
  /** The named place the character sees the turn end in, if any: where an arrival happens. */
  place: string | null
  /** That place, then every place containing it: where an event must happen to be seen. */
  around: string[]
  /** Who their schedule brings into that place during the turn. */
  arrivals: { npc: ScheduledNpc; at: number; activity: string | null }[]
  /** Handles of the people in the scene their schedule takes away. */
  leaving: string[]
  interrupted: TracedEvents['interrupted']
  awaited: TracedEvents['awaited']
}

/**
 * Where the clock stands once the turn is over, and what happens meanwhile.
 * The duration arbitration proposed, converted by the backend, after the
 * walk to the destination it named, timed on the quickest way — or the wait
 * until what the character waits for comes, a week at most, else an
 * afternoon spent for nothing. An event or an arrival the character sees cuts
 * anything longer than a moment short. An aside takes no time, whatever the
 * model proposed, and sets nothing off; a round lasts its twelve seconds.
 */
function planTime(
  scene: LoadedScene,
  decision: ArbitrationOutput,
  aside: boolean,
  route: Route | null,
  round: Round | null
): TurnTiming {
  const { world, snapshot } = scene
  const before = scene.worldState.gameTime
  const duration = decision.duration
  const place = route?.to ?? scene.here
  const around =
    route === null
      ? scene.around
      : placesAround(world, { definitionReference: route.to, parentReference: null })
  const quiet: TurnTiming = {
    time: { before, after: before, duration },
    due: [],
    place,
    around,
    arrivals: [],
    leaving: [],
    interrupted: null,
    awaited: null,
  }

  if (aside) {
    return quiet
  }

  const progressOf = progressReader(scene.eventRows)
  const inScene = new Set(scene.npcs.map(({ handle }) => handle))
  const scheduled = scheduledNpcs(world, scene.stopped)
  const walkEnd = before + (route?.seconds ?? 0)
  let end: number
  let awaited: TracedEvents['awaited'] = null

  if (round !== null) {
    /** A round lasts its twelve seconds; a character brought down is out for an hour. */
    end = before + ROUND_SECONDS + (round.character.down ? DOWN_SECONDS : 0)
  } else if (duration.label === 'until_event' || duration.label === 'until_npc') {
    const limit = walkEnd + MAX_DAYS * DAY
    let at: number | null = null

    if (duration.label === 'until_event') {
      const event = world.events.find(({ reference }) => reference === duration.event)
      at =
        event === undefined
          ? null
          : awaitedTimeOf(event, progressOf(event.reference), snapshot, {
              from: walkEnd,
              until: limit,
            })
    } else if (inScene.has(duration.npc)) {
      /** Already here: no wait. */
      at = walkEnd + FIXED_DURATIONS.moment
    } else {
      const npc = scheduled.find(({ reference }) => reference === duration.npc)
      at =
        npc === undefined || place === null
          ? null
          : (nextArrivalIn(npc.schedule, place, walkEnd, limit)?.at ?? null)
    }

    end = at ?? walkEnd + FIXED_DURATIONS.hours
    awaited =
      duration.label === 'until_event'
        ? { event: duration.event, arrived: at !== null }
        : { npc: duration.npc, arrived: at !== null }
  } else {
    end = walkEnd + secondsOf(duration, walkEnd)
  }

  /** Whoever a schedule brings where the character is, between two moments. */
  const arrivalsWithin = (from: number, to: number) =>
    place === null
      ? []
      : scheduled.flatMap((npc) => {
          const status = snapshot.npcs.get(npc.reference)?.status

          if (inScene.has(npc.reference) || status === 'dead' || status === 'dying') {
            return []
          }

          const move = nextArrivalIn(npc.schedule, place, from, to)

          return move === null ? [] : [{ npc, at: move.at, entry: move.entry }]
        })

  let interrupted: TracedEvents['interrupted'] = null

  if (round === null && duration.label !== 'moment') {
    const awaitedEvent = awaited !== null && 'event' in awaited ? awaited.event : null
    const awaitedNpc = awaited !== null && 'npc' in awaited ? awaited.npc : null
    const event = timedEventsDue(world.events, progressOf, snapshot, end).find(
      (due) =>
        due.outcome === 'fired' &&
        due.event.interrupts &&
        due.at > walkEnd &&
        due.at < end &&
        due.event.reference !== awaitedEvent &&
        witnesses(due.event, around)
    )
    const arrival = arrivalsWithin(walkEnd, end)
      .filter(
        ({ npc, entry, at }) =>
          at < end &&
          npc.reference !== awaitedNpc &&
          (entry.interrupts ||
            (snapshot.npcs.get(npc.reference)?.disposition ?? npc.defaultDisposition) === 'hostile')
      )
      .sort((a, b) => a.at - b.at)[0]

    if (event !== undefined && (arrival === undefined || event.at <= arrival.at)) {
      end = event.at
      interrupted = { event: event.event.reference, at: event.at }
    } else if (arrival !== undefined) {
      end = arrival.at
      interrupted = { npc: arrival.npc.reference, at: arrival.at }
    }

    if (interrupted !== null && awaited !== null) {
      awaited = { ...awaited, arrived: false }
    }
  }

  /** People of the scene their schedule calls away, unless it calls them where the character is. */
  const leaving = scene.npcs
    .map(({ handle }) => scheduled.find(({ reference }) => reference === handle))
    .filter((npc): npc is ScheduledNpc => npc !== undefined)
    .filter((npc) =>
      movesWithin(npc.schedule, before, end).some(
        ({ entry }) => entry.leavesScene && entry.location !== place
      )
    )
    .map(({ reference }) => reference)

  return {
    time: { before, after: end, duration },
    due: timedEventsDue(world.events, progressOf, snapshot, end),
    place,
    around,
    arrivals: arrivalsWithin(before, end).map(({ npc, at, entry }) => ({
      npc,
      at,
      activity: entry.activity,
    })),
    leaving,
    interrupted,
    awaited,
  }
}

/** What cut the action short, in English, for the narrator. */
function interruptionText(world: WorldDefinition, timing: TurnTiming): string | null {
  const cut = timing.interrupted

  if (cut === null) {
    return null
  }

  if ('event' in cut) {
    return world.events.find(({ reference }) => reference === cut.event)?.description ?? null
  }

  return `${cut.npc} arrives.`
}

/**
 * What the people in the scene are doing by their schedule, for those it has
 * where the character sees them as the turn ends.
 */
function activitiesOf(
  scene: LoadedScene,
  present: PresentNpc[],
  timing: TurnTiming
): { handle: string; activity: string }[] {
  return present.flatMap(({ handle }) => {
    const npc = scene.world.npcs.find(({ reference }) => reference === handle)
    const entry = npc?.kind === 'unique' ? entryAt(npc.schedule, timing.time.after) : null

    return entry?.activity && entry.location === timing.place
      ? [{ handle, activity: entry.activity }]
      : []
  })
}

/**
 * What a place is like at a time of day, in English: the notes of its
 * definition for the period, then the one an event left there, if any.
 */
function notesOf(
  world: WorldDefinition,
  place: { definitionReference: string } | null,
  eventNote: string | null,
  gameTime: number
): string[] {
  if (place === null) {
    return []
  }

  const period = periodAt(gameTime)
  const definition = world.locations.find(
    ({ reference }) => reference === place.definitionReference
  )

  return [
    ...(definition?.periodNotes ?? [])
      .filter(({ periods }) => periods.includes(period))
      .map(({ note }) => note),
    ...(eventNote === null ? [] : [eventNote]),
  ]
}

/** The context with whoever arrives during the turn, present for extraction to read. */
function withArrivals(
  context: TurnContext,
  arriving: NarrationRequest['npcs_arriving']
): TurnContext {
  if (arriving.length === 0) {
    return context
  }

  return {
    ...context,
    scene: {
      ...context.scene,
      npcs_present: [
        ...context.scene.npcs_present,
        ...arriving.map(({ handle, name, descriptor, disposition, condition }) => ({
          handle,
          name,
          descriptor,
          disposition,
          condition,
        })),
      ],
      npc_definitions: {
        ...context.scene.npc_definitions,
        ...Object.fromEntries(arriving.map(({ handle, definition }) => [handle, definition])),
      },
    },
  }
}

function npcDefinitionOf(world: WorldDefinition, reference: string): NpcDefinition {
  const definition = world.npcs.find((npc) => npc.reference === reference)

  if (definition === undefined) {
    throw new Error(`"${reference}" is not a person of the ${world.reference} world.`)
  }

  return definition
}

/**
 * The context with the archetype a round brought in, present under the
 * handle the turn will give them — the narration names them, extraction
 * may move them, before they exist.
 */
function withOpponent(
  context: TurnContext,
  round: TracedRound | null,
  world: WorldDefinition
): TurnContext {
  if (round === null || round.provisional === null) {
    return context
  }

  const definition = world.npcs.find(({ reference }) => reference === round.provisional!.definition)
  const opponent: PresentNpc = {
    handle: round.opponent,
    name: null,
    descriptor: null,
    disposition: definition?.defaultDisposition ?? 'neutral',
    condition:
      round.opponentAfter.state === 'fighting'
        ? 'standing'
        : round.opponentAfter.state === 'down'
          ? 'down'
          : 'dying',
  }

  return {
    ...context,
    scene: {
      ...context.scene,
      npcs_present: [...context.scene.npcs_present, opponent],
      npc_definitions: {
        ...context.scene.npc_definitions,
        [round.opponent]: round.provisional.definition,
      },
    },
  }
}

function narratedFirstAid(aid: TracedFirstAid | null): NarratedFirstAid | null {
  if (aid === null) {
    return null
  }

  return {
    target: aid.target,
    effect: !aid.available
      ? 'already_tended'
      : aid.healed > 0
        ? 'healed'
        : aid.healed < 0
          ? 'worsened'
          : 'no_effect',
    saved: aid.saved,
  }
}

/**
 * Where a movement may lead from where the scene began, for extraction to
 * pick from: inside a network, the places its exits reach once every hidden
 * one is found and every locked one opened — validation then checks the
 * narration did find or open what the way needs; outside one, the places
 * travelled to freely, and an improvised place. The place itself stays in the
 * list: going where one stands is no movement, not a mistake.
 */
function movementOptionsOf(scene: LoadedScene) {
  const places = scene.world.locations
  const after = (opened: { discovered: string[]; unlocked: string[] }) => {
    const { places: reached } = destinationsFrom(
      places,
      scene.here,
      withExitsOpened(places, scene.here, scene.travel, opened)
    )

    return scene.here === null ? reached : [...new Set([scene.here, ...reached])]
  }
  const { improvise } = destinationsFrom(places, scene.here, scene.travel)

  return {
    destinations: after({
      discovered: scene.exits.filter(({ hidden }) => hidden).map(({ to }) => to),
      unlocked: scene.exits.filter(({ locked }) => locked).map(({ to }) => to),
    }),
    archetypes: improvise ? locationArchetypeReferences(scene.world) : [],
    parents: improvise ? improvisationParents(places) : [],
    after,
  }
}

/** The quickest way to the destination arbitration named, validated against the same routes. */
function routeTo(scene: LoadedScene, destination: string | null): Route | null {
  return destination === null ? null : (scene.routes.find(({ to }) => to === destination) ?? null)
}

/** The reference of a named place the game stands in; null for an improvised one. */
function uniqueReferenceOf(
  world: WorldDefinition,
  place: { definitionReference: string } | null
): string | null {
  if (place === null) {
    return null
  }

  const definition = world.locations.find(
    ({ reference }) => reference === place.definitionReference
  )

  return definition?.kind === 'unique' ? definition.reference : null
}

/**
 * What the place is like, in English: a named place's description, or an
 * improvised one's descriptor with the description of what it stands in.
 * A few dozen tokens, never the catalogue.
 */
function describePlace(
  world: WorldDefinition,
  place: LocationInstance | null
): { placeDescription: string | null; surroundings: string | null } {
  if (place === null) {
    return { placeDescription: null, surroundings: null }
  }

  const definitionOf = (reference: string | null) =>
    world.locations.find((location) => location.reference === reference)
  const definition = definitionOf(place.definitionReference)

  if (definition?.kind === 'unique') {
    return { placeDescription: definition.description, surroundings: null }
  }

  return {
    placeDescription: place.descriptor ?? null,
    surroundings: definitionOf(place.parentReference)?.description ?? null,
  }
}

function toRecentBuffer(turns: TurnLog[]): RecentTurn[] {
  return turns.flatMap((turn) => {
    const entries: RecentTurn[] = [{ role: 'player', text: turn.playerInput }]

    if (turn.narratedText) {
      entries.push({ role: 'narration', text: turn.narratedText })
    }

    return entries
  })
}

function refOf(turn: TurnLog): TurnRef {
  return { turnId: turn.id, sessionId: turn.sessionId, idempotencyKey: turn.idempotencyKey }
}
