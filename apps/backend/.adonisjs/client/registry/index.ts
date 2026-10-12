/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.new_account.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [{"old":"/api/v1/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.new_account.store']['types'],
  },
  'auth.login.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login.store']['types'],
  },
  'auth.csrf': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/csrf',
    tokens: [{"old":"/api/v1/auth/csrf","type":0,"val":"api","end":""},{"old":"/api/v1/auth/csrf","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/csrf","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/csrf","type":0,"val":"csrf","end":""}],
    types: placeholder as Registry['auth.csrf']['types'],
  },
  'profile.profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.show']['types'],
  },
  'profile.login.destroy': {
    methods: ["POST"],
    pattern: '/api/v1/account/logout',
    tokens: [{"old":"/api/v1/account/logout","type":0,"val":"api","end":""},{"old":"/api/v1/account/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/account/logout","type":0,"val":"account","end":""},{"old":"/api/v1/account/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['profile.login.destroy']['types'],
  },
  'game.scenarios.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/scenarios',
    tokens: [{"old":"/api/v1/scenarios","type":0,"val":"api","end":""},{"old":"/api/v1/scenarios","type":0,"val":"v1","end":""},{"old":"/api/v1/scenarios","type":0,"val":"scenarios","end":""}],
    types: placeholder as Registry['game.scenarios.index']['types'],
  },
  'game.sessions.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sessions',
    tokens: [{"old":"/api/v1/sessions","type":0,"val":"api","end":""},{"old":"/api/v1/sessions","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions","type":0,"val":"sessions","end":""}],
    types: placeholder as Registry['game.sessions.index']['types'],
  },
  'game.sessions.store': {
    methods: ["POST"],
    pattern: '/api/v1/sessions',
    tokens: [{"old":"/api/v1/sessions","type":0,"val":"api","end":""},{"old":"/api/v1/sessions","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions","type":0,"val":"sessions","end":""}],
    types: placeholder as Registry['game.sessions.store']['types'],
  },
  'game.sessions.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sessions/:id',
    tokens: [{"old":"/api/v1/sessions/:id","type":0,"val":"api","end":""},{"old":"/api/v1/sessions/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions/:id","type":0,"val":"sessions","end":""},{"old":"/api/v1/sessions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['game.sessions.show']['types'],
  },
  'game.turns.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sessions/:id/turns',
    tokens: [{"old":"/api/v1/sessions/:id/turns","type":0,"val":"api","end":""},{"old":"/api/v1/sessions/:id/turns","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions/:id/turns","type":0,"val":"sessions","end":""},{"old":"/api/v1/sessions/:id/turns","type":1,"val":"id","end":""},{"old":"/api/v1/sessions/:id/turns","type":0,"val":"turns","end":""}],
    types: placeholder as Registry['game.turns.index']['types'],
  },
  'game.turns.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sessions/:id/turns/:turnId',
    tokens: [{"old":"/api/v1/sessions/:id/turns/:turnId","type":0,"val":"api","end":""},{"old":"/api/v1/sessions/:id/turns/:turnId","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions/:id/turns/:turnId","type":0,"val":"sessions","end":""},{"old":"/api/v1/sessions/:id/turns/:turnId","type":1,"val":"id","end":""},{"old":"/api/v1/sessions/:id/turns/:turnId","type":0,"val":"turns","end":""},{"old":"/api/v1/sessions/:id/turns/:turnId","type":1,"val":"turnId","end":""}],
    types: placeholder as Registry['game.turns.show']['types'],
  },
  'game.turns.store': {
    methods: ["POST"],
    pattern: '/api/v1/sessions/:id/turns',
    tokens: [{"old":"/api/v1/sessions/:id/turns","type":0,"val":"api","end":""},{"old":"/api/v1/sessions/:id/turns","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions/:id/turns","type":0,"val":"sessions","end":""},{"old":"/api/v1/sessions/:id/turns","type":1,"val":"id","end":""},{"old":"/api/v1/sessions/:id/turns","type":0,"val":"turns","end":""}],
    types: placeholder as Registry['game.turns.store']['types'],
  },
  'admin.worlds.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/worlds',
    tokens: [{"old":"/api/v1/admin/worlds","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds","type":0,"val":"worlds","end":""}],
    types: placeholder as Registry['admin.worlds.index']['types'],
  },
  'admin.worlds.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/worlds',
    tokens: [{"old":"/api/v1/admin/worlds","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds","type":0,"val":"worlds","end":""}],
    types: placeholder as Registry['admin.worlds.store']['types'],
  },
  'admin.worlds.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/worlds/:worldId',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":1,"val":"worldId","end":""}],
    types: placeholder as Registry['admin.worlds.show']['types'],
  },
  'admin.worlds.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/worlds/:worldId',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":1,"val":"worldId","end":""}],
    types: placeholder as Registry['admin.worlds.update']['types'],
  },
  'admin.worlds.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/worlds/:worldId',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId","type":1,"val":"worldId","end":""}],
    types: placeholder as Registry['admin.worlds.destroy']['types'],
  },
  'admin.action_types.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/worlds/:worldId/action-types',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":1,"val":"worldId","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"action-types","end":""}],
    types: placeholder as Registry['admin.action_types.index']['types'],
  },
  'admin.action_types.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/worlds/:worldId/action-types',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":1,"val":"worldId","end":""},{"old":"/api/v1/admin/worlds/:worldId/action-types","type":0,"val":"action-types","end":""}],
    types: placeholder as Registry['admin.action_types.store']['types'],
  },
  'admin.action_types.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/action-types/:id',
    tokens: [{"old":"/api/v1/admin/action-types/:id","type":0,"val":"api","end":""},{"old":"/api/v1/admin/action-types/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/action-types/:id","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/action-types/:id","type":0,"val":"action-types","end":""},{"old":"/api/v1/admin/action-types/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.action_types.update']['types'],
  },
  'admin.action_types.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/action-types/:id',
    tokens: [{"old":"/api/v1/admin/action-types/:id","type":0,"val":"api","end":""},{"old":"/api/v1/admin/action-types/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/action-types/:id","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/action-types/:id","type":0,"val":"action-types","end":""},{"old":"/api/v1/admin/action-types/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.action_types.destroy']['types'],
  },
  'admin.scenarios.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/worlds/:worldId/scenarios',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":1,"val":"worldId","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"scenarios","end":""}],
    types: placeholder as Registry['admin.scenarios.index']['types'],
  },
  'admin.scenarios.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/worlds/:worldId/scenarios',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":1,"val":"worldId","end":""},{"old":"/api/v1/admin/worlds/:worldId/scenarios","type":0,"val":"scenarios","end":""}],
    types: placeholder as Registry['admin.scenarios.store']['types'],
  },
  'admin.scenarios.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/scenarios/:scenarioId',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":1,"val":"scenarioId","end":""}],
    types: placeholder as Registry['admin.scenarios.show']['types'],
  },
  'admin.scenarios.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/scenarios/:scenarioId',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":1,"val":"scenarioId","end":""}],
    types: placeholder as Registry['admin.scenarios.update']['types'],
  },
  'admin.scenarios.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/scenarios/:scenarioId',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId","type":1,"val":"scenarioId","end":""}],
    types: placeholder as Registry['admin.scenarios.destroy']['types'],
  },
  'admin.scenarios.publish': {
    methods: ["POST"],
    pattern: '/api/v1/admin/scenarios/:scenarioId/publish',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId/publish","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/publish","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/publish","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/publish","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/publish","type":1,"val":"scenarioId","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/publish","type":0,"val":"publish","end":""}],
    types: placeholder as Registry['admin.scenarios.publish']['types'],
  },
  'admin.scenarios.unpublish': {
    methods: ["POST"],
    pattern: '/api/v1/admin/scenarios/:scenarioId/unpublish',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId/unpublish","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/unpublish","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/unpublish","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/unpublish","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/unpublish","type":1,"val":"scenarioId","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/unpublish","type":0,"val":"unpublish","end":""}],
    types: placeholder as Registry['admin.scenarios.unpublish']['types'],
  },
  'admin.definitions.world.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/worlds/:worldId/:catalogue',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":1,"val":"worldId","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":1,"val":"catalogue","end":""}],
    types: placeholder as Registry['admin.definitions.world.index']['types'],
  },
  'admin.definitions.world.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/worlds/:worldId/:catalogue',
    tokens: [{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"api","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":0,"val":"worlds","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":1,"val":"worldId","end":""},{"old":"/api/v1/admin/worlds/:worldId/:catalogue","type":1,"val":"catalogue","end":""}],
    types: placeholder as Registry['admin.definitions.world.store']['types'],
  },
  'admin.definitions.scenario.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/scenarios/:scenarioId/:catalogue',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":1,"val":"scenarioId","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":1,"val":"catalogue","end":""}],
    types: placeholder as Registry['admin.definitions.scenario.index']['types'],
  },
  'admin.definitions.scenario.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/scenarios/:scenarioId/:catalogue',
    tokens: [{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"api","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":0,"val":"scenarios","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":1,"val":"scenarioId","end":""},{"old":"/api/v1/admin/scenarios/:scenarioId/:catalogue","type":1,"val":"catalogue","end":""}],
    types: placeholder as Registry['admin.definitions.scenario.store']['types'],
  },
  'admin.definitions.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/:catalogue/:definitionId',
    tokens: [{"old":"/api/v1/admin/:catalogue/:definitionId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":1,"val":"catalogue","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":1,"val":"definitionId","end":""}],
    types: placeholder as Registry['admin.definitions.update']['types'],
  },
  'admin.definitions.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/:catalogue/:definitionId',
    tokens: [{"old":"/api/v1/admin/:catalogue/:definitionId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":1,"val":"catalogue","end":""},{"old":"/api/v1/admin/:catalogue/:definitionId","type":1,"val":"definitionId","end":""}],
    types: placeholder as Registry['admin.definitions.destroy']['types'],
  },
  'event_stream': {
    methods: ["GET","HEAD"],
    pattern: '/__transmit/events',
    tokens: [{"old":"/__transmit/events","type":0,"val":"__transmit","end":""},{"old":"/__transmit/events","type":0,"val":"events","end":""}],
    types: placeholder as Registry['event_stream']['types'],
  },
  'subscribe': {
    methods: ["POST"],
    pattern: '/__transmit/subscribe',
    tokens: [{"old":"/__transmit/subscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/subscribe","type":0,"val":"subscribe","end":""}],
    types: placeholder as Registry['subscribe']['types'],
  },
  'unsubscribe': {
    methods: ["POST"],
    pattern: '/__transmit/unsubscribe',
    tokens: [{"old":"/__transmit/unsubscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/unsubscribe","type":0,"val":"unsubscribe","end":""}],
    types: placeholder as Registry['unsubscribe']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
