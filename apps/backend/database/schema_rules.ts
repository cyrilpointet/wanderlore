import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Typing overrides applied when `database/schema.ts` is regenerated.
 *
 * The generator maps every native enum to `string` and every `jsonb` column to
 * `any`. Narrowing them here keeps the generated file authoritative — an
 * override written straight into a model would be lost on the next migration.
 */
const column = [{ name: '@column' }]

/**
 * `pg` turns a JavaScript array into a PostgreSQL array literal instead of
 * serializing it, which a jsonb column rejects outright. Array-valued jsonb
 * columns therefore have to be stringified on the way in.
 *
 * `null` and `undefined` pass through untouched: stringifying them would store
 * a JSON `null` where the column expects SQL NULL, and a turn that failed
 * mid-pipeline would read back as though it held a value.
 */
const arrayColumn = [
  {
    name: '@column',
    args: {
      prepare: (value: unknown) =>
        value === null || value === undefined ? value : JSON.stringify(value),
    },
  },
]

/**
 * Structural shapes rather than named domain types: the exact payloads of the
 * turn pipeline are not settled yet. They are narrowed further once the
 * arbitration and effect schemas exist, and a named type written today would
 * only be a placeholder to rewrite. Nullable columns get their `| null` from
 * the generator, so it is not spelled out here.
 */
const jsonObject = { tsType: 'Record<string, unknown>', decorators: column }
const jsonObjectList = { tsType: 'Record<string, unknown>[]', decorators: arrayColumn }
const numbersByKey = { tsType: 'Record<string, number>', decorators: column }

export default {
  tables: {
    users: {
      columns: {
        role: {
          tsType: "'player' | 'game_master' | 'superadmin'",
          decorators: column,
        },
      },
    },

    sessions: {
      columns: {
        status: {
          tsType: "'in_progress' | 'paused' | 'completed'",
          decorators: column,
        },
      },
    },

    characters: {
      columns: {
        attributes: numbersByKey,
        skills: numbersByKey,
        resources: numbersByKey,
        progression: jsonObject,
      },
    },

    world_states: {
      columns: {
        active_quests: jsonObjectList,
        /**
         * Left wide although the scenario only stores booleans today: a flag
         * carrying a value would otherwise break the build rather than widen
         * the type.
         */
        narrative_flags: jsonObject,
        visited_locations: jsonObjectList,
        world_objects: jsonObjectList,
      },
    },

    turn_log: {
      columns: {
        arbitration_output: jsonObject,
        roll_result: jsonObject,
        applied_effects: jsonObject,
        alerts: jsonObjectList,
        llm_usage: jsonObjectList,
      },
    },
  },
} satisfies SchemaRules
