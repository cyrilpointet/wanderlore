import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Typing overrides applied when `database/schema.ts` is regenerated.
 *
 * The generator maps every native enum to `string` and every `jsonb` column to
 * `any`. Narrowing them here keeps the generated file authoritative — an
 * override written straight into a model would be lost on the next migration.
 */
export default {
  tables: {
    users: {
      columns: {
        role: {
          tsType: "'player' | 'game_master' | 'superadmin'",
          decorators: [{ name: '@column' }],
        },
      },
    },

    sessions: {
      columns: {
        status: {
          tsType: "'in_progress' | 'paused' | 'completed'",
          decorators: [{ name: '@column' }],
        },
      },
    },
  },
} satisfies SchemaRules
