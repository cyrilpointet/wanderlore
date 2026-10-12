/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    login: {
      store: typeof routes['auth.login.store']
    }
    csrf: typeof routes['auth.csrf']
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
    }
    login: {
      destroy: typeof routes['profile.login.destroy']
    }
  }
  game: {
    scenarios: {
      index: typeof routes['game.scenarios.index']
    }
    sessions: {
      index: typeof routes['game.sessions.index']
      store: typeof routes['game.sessions.store']
      show: typeof routes['game.sessions.show']
    }
    turns: {
      index: typeof routes['game.turns.index']
      show: typeof routes['game.turns.show']
      store: typeof routes['game.turns.store']
    }
  }
  admin: {
    worlds: {
      index: typeof routes['admin.worlds.index']
      store: typeof routes['admin.worlds.store']
      show: typeof routes['admin.worlds.show']
      update: typeof routes['admin.worlds.update']
      destroy: typeof routes['admin.worlds.destroy']
    }
    actionTypes: {
      index: typeof routes['admin.action_types.index']
      store: typeof routes['admin.action_types.store']
      update: typeof routes['admin.action_types.update']
      destroy: typeof routes['admin.action_types.destroy']
    }
    scenarios: {
      index: typeof routes['admin.scenarios.index']
      store: typeof routes['admin.scenarios.store']
      show: typeof routes['admin.scenarios.show']
      update: typeof routes['admin.scenarios.update']
      destroy: typeof routes['admin.scenarios.destroy']
    }
    definitions: {
      world: {
        index: typeof routes['admin.definitions.world.index']
        store: typeof routes['admin.definitions.world.store']
      }
      scenario: {
        index: typeof routes['admin.definitions.scenario.index']
        store: typeof routes['admin.definitions.scenario.store']
      }
      update: typeof routes['admin.definitions.update']
      destroy: typeof routes['admin.definitions.destroy']
    }
  }
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
}
