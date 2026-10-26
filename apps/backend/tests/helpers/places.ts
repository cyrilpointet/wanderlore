import { resolveWorld } from '#services/game/content/resolve'
import type { WorldDefinition } from '#services/game/world'
import type {
  ItemDefinitionContent,
  LocationDefinitionContent,
  LocationExit,
  ScenarioContent,
} from '#services/game/content/types'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'

/** An exit as the specs write it: only what differs from a plain, open, two-way door. */
export function exit(to: string, passage: string, rest: Partial<LocationExit> = {}): LocationExit {
  return {
    to,
    passage,
    backPassage: null,
    hidden: false,
    requires: null,
    oneWay: false,
    duration: null,
    ...rest,
  }
}

function place(
  reference: string,
  rest: Partial<LocationDefinitionContent> = {}
): LocationDefinitionContent {
  return {
    reference,
    labels: { en: reference.replace(/^house_/, 'The ').replace(/_/g, ' ') },
    description: `The ${reference.replace(/_/g, ' ')}, for a spec.`,
    kind: 'unique',
    parent: 'house',
    exits: [],
    entrance: false,
    ...rest,
  }
}

/**
 * A house in Paris, gone through room by room: the network the specs walk.
 *
 * ```
 *   yard* ── hall ── kitchen* ── cellar ──▶ vault
 *             │ │ \                 │
 *             │ │  \_(an hour)______│
 *             │ study ┄(hidden)┄┄┄┄┄┘
 *             │ (iron key)
 *         corridor (ten minutes up)
 *          │      │
 *        attic  bedroom
 * ```
 *
 * `*` marks an entrance. The hidden passage is hidden from the study only;
 * the chute into the vault is one-way.
 */
export const HOUSE_PLACES: LocationDefinitionContent[] = [
  place('house', { labels: { en: 'The house' }, parent: 'paris' }),
  place('house_yard', {
    entrance: true,
    exits: [exit('house_hall', 'the front door')],
  }),
  place('house_hall', {
    exits: [
      exit('house_kitchen', 'a swing door'),
      exit('house_corridor', 'the main staircase, going up', {
        backPassage: 'the main staircase, going down',
        duration: 'minutes',
      }),
      exit('house_study', 'a locked oak door', { requires: 'iron_key' }),
      exit('house_cellar', 'a long tunnel under the floor', { duration: 'hour' }),
    ],
  }),
  place('house_kitchen', {
    entrance: true,
    exits: [exit('house_cellar', 'the cellar stairs')],
  }),
  place('house_corridor', {
    exits: [exit('house_attic', 'a ladder'), exit('house_bedroom', 'a bedroom door')],
  }),
  place('house_attic'),
  place('house_bedroom'),
  place('house_study', {
    exits: [
      exit('house_cellar', 'a bookcase that swings open', {
        backPassage: 'a narrow door at the top of the steps',
        hidden: true,
      }),
    ],
  }),
  place('house_cellar', {
    exits: [exit('house_vault', 'a chute into the dark', { oneWay: true })],
  }),
  place('house_vault'),
]

export const IRON_KEY: ItemDefinitionContent = {
  reference: 'iron_key',
  labels: { en: 'Iron key' },
  description: 'A heavy iron key, the one to the study.',
  kind: 'unique',
  generic: false,
  stackable: false,
  equippable: false,
  modifiers: [],
  weapon: null,
  initialHolder: null,
}

const { scenarios, ...MUSKETEERS_WORLD } = THREE_MUSKETEERS_CONTENT

/** *A Gascon in Paris*, with the house among its places and the key among its items. */
export const HOUSE_SCENARIO: ScenarioContent = {
  ...scenarios[0],
  locations: [...scenarios[0].locations, ...HOUSE_PLACES],
  items: [...scenarios[0].items, IRON_KEY],
}

/** The world a turn reads, with the house in it. */
export const HOUSE_WORLD: WorldDefinition = resolveWorld(MUSKETEERS_WORLD, HOUSE_SCENARIO)
