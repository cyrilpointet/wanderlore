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
    turns: {
      store: typeof routes['game.turns.store']
    }
  }
}
