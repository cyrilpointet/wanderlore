/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.login.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/login_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/login_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.csrf': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/csrf'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'profile.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'profile.login.destroy': {
    methods: ["POST"]
    pattern: '/api/v1/account/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/login_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/login_controller').default['destroy']>>>
    }
  }
  'game.scenarios.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/scenarios'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/scenarios_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/scenarios_controller').default['index']>>>
    }
  }
  'game.sessions.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/sessions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['index']>>>
    }
  }
  'game.sessions.store': {
    methods: ["POST"]
    pattern: '/api/v1/sessions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/session').startGameValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/session').startGameValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game.sessions.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/sessions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['show']>>>
    }
  }
  'game.turns.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/sessions/:id/turns'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/turns_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/turns_controller').default['index']>>>
    }
  }
  'game.turns.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/sessions/:id/turns/:turnId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; turnId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/turns_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/turns_controller').default['show']>>>
    }
  }
  'game.turns.store': {
    methods: ["POST"]
    pattern: '/api/v1/sessions/:id/turns'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/turn').playTurnValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/turn').playTurnValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/turns_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/turns_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.worlds.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/worlds'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['index']>>>
    }
  }
  'admin.worlds.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/worlds'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/content').createWorldValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/content').createWorldValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.worlds.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/worlds/:worldId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['show']>>>
    }
  }
  'admin.worlds.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/worlds/:worldId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/content').updateWorldValidator)>>
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/content').updateWorldValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.worlds.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/worlds/:worldId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/worlds_controller').default['destroy']>>>
    }
  }
  'admin.action_types.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/worlds/:worldId/action-types'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['index']>>>
    }
  }
  'admin.action_types.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/worlds/:worldId/action-types'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/content').createActionTypeValidator)>>
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/content').createActionTypeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.action_types.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/action-types/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/content').updateActionTypeValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/content').updateActionTypeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.action_types.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/action-types/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/action_types_controller').default['destroy']>>>
    }
  }
  'admin.scenarios.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/worlds/:worldId/scenarios'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['index']>>>
    }
  }
  'admin.scenarios.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/worlds/:worldId/scenarios'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/content').createScenarioValidator)>>
      paramsTuple: [ParamValue]
      params: { worldId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/content').createScenarioValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.scenarios.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/scenarios/:scenarioId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { scenarioId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['show']>>>
    }
  }
  'admin.scenarios.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/scenarios/:scenarioId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/content').updateScenarioValidator)>>
      paramsTuple: [ParamValue]
      params: { scenarioId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/content').updateScenarioValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.scenarios.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/scenarios/:scenarioId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { scenarioId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/scenarios_controller').default['destroy']>>>
    }
  }
  'admin.definitions.world.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/worlds/:worldId/:catalogue'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { worldId: ParamValue; catalogue: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['index']>>>
    }
  }
  'admin.definitions.world.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/worlds/:worldId/:catalogue'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { worldId: ParamValue; catalogue: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['store']>>>
    }
  }
  'admin.definitions.scenario.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/scenarios/:scenarioId/:catalogue'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { scenarioId: ParamValue; catalogue: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['index']>>>
    }
  }
  'admin.definitions.scenario.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/scenarios/:scenarioId/:catalogue'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { scenarioId: ParamValue; catalogue: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['store']>>>
    }
  }
  'admin.definitions.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/:catalogue/:definitionId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { catalogue: ParamValue; definitionId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['update']>>>
    }
  }
  'admin.definitions.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/:catalogue/:definitionId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { catalogue: ParamValue; definitionId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/definitions_controller').default['destroy']>>>
    }
  }
  'event_stream': {
    methods: ["GET","HEAD"]
    pattern: '/__transmit/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'subscribe': {
    methods: ["POST"]
    pattern: '/__transmit/subscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'unsubscribe': {
    methods: ["POST"]
    pattern: '/__transmit/unsubscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
