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
    sessions: {
      index: typeof routes['game.sessions.index']
      show: typeof routes['game.sessions.show']
    }
    turns: {
      index: typeof routes['game.turns.index']
      show: typeof routes['game.turns.show']
      store: typeof routes['game.turns.store']
    }
  }
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
}
