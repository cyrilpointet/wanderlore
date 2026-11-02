import env from '#start/env'

/**
 * Game settings fixed per deployment.
 */
const gameConfig = {
  /**
   * The language a turn is narrated in when the submission names none —
   * until the player picks one (Phase 14). English when unset. Everything
   * else stays English whatever it is: lore, state, prompts, summaries.
   */
  defaultLanguage: env.get('DEFAULT_LANGUAGE', 'en'),
}

export default gameConfig
