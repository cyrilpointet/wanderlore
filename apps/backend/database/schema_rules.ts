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

/**
 * Game content columns, typed with the shapes of `#services/game/content/types`:
 * their payloads are settled, and the back-office writes them whole.
 */
function content(type: string, options: { array?: boolean } = {}) {
  const name = type.replace(/\[\]$/, '')

  return {
    tsType: type,
    decorators: options.array ? arrayColumn : column,
    imports: [{ source: '#services/game/content/types', typeImports: [name] }],
  }
}

const labels = content('Labels')
const kind = content('DefinitionKind')

/**
 * A calendar date, kept as the `YYYY-MM-DD` it was written as. `pg` reads a
 * `date` into a JavaScript `Date` at local midnight, which the local parts
 * turn back into that same day whatever the time zone.
 *
 * Self-contained on purpose: the generator copies the function's source into
 * `database/schema.ts`, where nothing around it would be in scope.
 */
const calendarDate = {
  tsType: 'string',
  decorators: [
    {
      name: '@column',
      args: {
        consume: (value: unknown) =>
          value instanceof Date
            ? [value.getFullYear(), value.getMonth() + 1, value.getDate()]
                .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
                .join('-')
            : value,
      },
    },
  ],
}

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

    worlds: {
      columns: {
        labels,
        rules: { tsType: 'string[]', decorators: arrayColumn },
        ambiance: { tsType: 'string[]', decorators: arrayColumn },
        skills: content('SkillEntry[]', { array: true }),
        resources: content('LabelledEntry[]', { array: true }),
        glossary: content('GlossaryEntry[]', { array: true }),
      },
    },

    scenarios: {
      columns: {
        labels,
        status: content('ScenarioStatus'),
        chapters: content('LabelledEntry[]', { array: true }),
        quests: content('LabelledEntry[]', { array: true }),
        pregenerated_character: content('PregeneratedCharacter'),
        initial_state: content('InitialState'),
        glossary: content('GlossaryEntry[]', { array: true }),
        /** `HH:MM`: a `time` reads back with its seconds, which a scenario never has. */
        start_time: {
          tsType: 'string',
          decorators: [
            {
              name: '@column',
              args: {
                consume: (value: unknown) => (typeof value === 'string' ? value.slice(0, 5) : value),
              },
            },
          ],
        },
        start_date: calendarDate,
      },
    },

    npc_definitions: {
      columns: {
        labels,
        kind,
        default_disposition: content('NpcDisposition'),
        combat: content('CombatProfile'),
      },
    },

    location_definitions: {
      columns: { labels, kind, exits: content('LocationExit[]', { array: true }) },
    },

    item_definitions: {
      columns: {
        labels,
        kind,
        modifiers: content('ItemModifier[]', { array: true }),
        weapon: content('WeaponProfile'),
        initial_holder: content('ItemHolderReference'),
      },
    },

    npc_instances: {
      columns: {
        disposition: {
          tsType: "'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied'",
          decorators: column,
        },
        status: {
          tsType: "'present' | 'absent' | 'dead'",
          decorators: column,
        },
      },
    },

    inventory_items: {
      columns: {
        state: {
          tsType: "'carried' | 'equipped' | 'gone'",
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

    resolution_rules: {
      columns: {
        associated_characteristic: content('Characteristic'),
      },
    },

    characters: {
      columns: {
        characteristics: content('Characteristics'),
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
        start_date: calendarDate,
      },
    },

    turn_log: {
      columns: {
        arbitration_output: jsonObject,
        roll_result: jsonObject,
        applied_effects: jsonObject,
        status: {
          tsType: "'pending' | 'completed' | 'failed'",
          decorators: column,
        },
        failure: jsonObject,
        alerts: jsonObjectList,
        llm_usage: jsonObjectList,
        extraction_output: jsonObject,
        rejected_attempts: jsonObjectList,
        duration: {
          tsType: 'Duration',
          decorators: column,
          imports: [{ source: '#services/game/game_time', typeImports: ['Duration'] }],
        },
      },
    },
  },
} satisfies SchemaRules
