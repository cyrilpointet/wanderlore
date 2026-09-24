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
  'game.sessions.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sessions',
    tokens: [{"old":"/api/v1/sessions","type":0,"val":"api","end":""},{"old":"/api/v1/sessions","type":0,"val":"v1","end":""},{"old":"/api/v1/sessions","type":0,"val":"sessions","end":""}],
    types: placeholder as Registry['game.sessions.index']['types'],
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
