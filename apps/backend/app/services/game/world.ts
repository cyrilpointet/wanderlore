/**
 * The Phase 1 world, hardcoded.
 *
 * It lives in code on purpose: Phase 1 leans on a world the model already
 * knows, with no lore corpus of its own. From Phase 5 this same shape comes out
 * of the `worlds` table and nothing here changes but its source.
 *
 * *The Three Musketeers* is public domain, so the intellectual-property caveat
 * the roadmap raises about borrowed settings does not apply.
 *
 * Everything is in English, including skill references. Only the narration is
 * ever produced in the player's language.
 */

/**
 * A piece of world content: the stable reference the state and the model use,
 * and the label the player reads.
 *
 * The labels are a stopgap until Phase 5, where `display_names` and `glossary`
 * take over and bring translations with them. They are English, like the
 * interface.
 */
export type ContentEntry = {
  reference: string
  label: string
}

export type WorldSkill = ContentEntry & {
  /** Reference of the attribute the skill hangs off. */
  attribute: string
}

export type WorldDefinition = {
  reference: string
  label: string
  /** One line, handed to both steps so arbitration and narration agree on register. */
  tone: string
  /**
   * Facts that constrain what is *possible*. Arbitration only — the narrator
   * has no business ruling on plausibility.
   */
  rules: string[]
  /**
   * Sensory material for the narrator. Never sent to arbitration, which would
   * only pay for tokens it cannot act on.
   */
  ambiance: string[]
  attributes: ContentEntry[]
  skills: WorldSkill[]
  resources: ContentEntry[]
  /**
   * Closed catalogue of the people the scene can hold. The model picks from
   * it and never invents someone with state of their own.
   */
  npcs: NpcDefinition[]
  /**
   * Closed catalogue of places, named or generic. A place the model made up
   * would have no label to show.
   */
  locations: LocationDefinition[]
  chapters: ContentEntry[]
  quests: ContentEntry[]
}

/** Qualitative only: the model proposes one of these, never a number. */
export const NPC_DISPOSITIONS = ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied'] as const

export type NpcDisposition = (typeof NPC_DISPOSITIONS)[number]

type DescribedEntry = ContentEntry & {
  /** One line of English for the model, never shown to the player. */
  description: string
}

/**
 * A person of the world. A `unique` has at most one instance per game, an
 * `archetype` as many as the story needs. The improvised passer-by is an instance of a
 * `generic` archetype, with a free-text descriptor and no definition of its
 * own.
 */
export type NpcDefinition = DescribedEntry & {
  defaultDisposition: NpcDisposition
} & ({ kind: 'unique' } | { kind: 'archetype'; generic: boolean })

/**
 * A place of the world. A unique place declares the place that contains it;
 * an archetype gets its parent per instance, picked from the unique places.
 * Every archetype serves improvised places, so none needs a `generic` flag.
 */
export type LocationDefinition = DescribedEntry &
  ({ kind: 'unique'; parent: string | null } | { kind: 'archetype' })

export const THREE_MUSKETEERS: WorldDefinition = {
  reference: 'three_musketeers',
  label: 'The Three Musketeers',

  tone: 'France, 1625: cloak-and-dagger adventure, court intrigue, honour and hot tempers.',

  rules: [
    'This is history, not fantasy: there is no magic, no monster and no supernatural event.',
    'Firearms are single-shot, slow to reload, loud, and useless in the rain. The sword settles most fights.',
    'Duelling is forbidden by edict of Cardinal Richelieu, and his Guards enforce it eagerly.',
    'Rank, patronage and a letter from the right person open doors that coin cannot.',
    'The King and the Cardinal each command loyal swords, and the two factions watch each other constantly.',
    'Travel is by horse, cart or ship, and takes days. Nothing crosses to London overnight.',
    'News travels by rumour, letter and messenger — never faster than a rider.',
  ],

  ambiance: [
    'Paris is mud, torchlight, church bells and narrow streets that stink in summer.',
    'Taverns are crowded, loud, and full of men looking for a reason to draw.',
    'A musketeer is known by his cloak and his swagger before he is known by his name.',
    'The court glitters, and everyone in it is calculating something.',
  ],

  attributes: [
    { reference: 'physical', label: 'Physical' },
    { reference: 'mental', label: 'Mental' },
    { reference: 'social', label: 'Social' },
  ],

  /**
   * Flat and short on purpose: the rules document warns that the simpler the
   * skill list, the more reliably the arbitration step resolves an action onto
   * exactly one of them.
   */
  skills: [
    { reference: 'swordsmanship', label: 'Swordsmanship', attribute: 'physical' },
    { reference: 'athletics', label: 'Athletics', attribute: 'physical' },
    { reference: 'stealth', label: 'Stealth', attribute: 'physical' },
    { reference: 'marksmanship', label: 'Marksmanship', attribute: 'physical' },
    { reference: 'observation', label: 'Observation', attribute: 'mental' },
    { reference: 'scholarship', label: 'Scholarship', attribute: 'mental' },
    { reference: 'persuasion', label: 'Persuasion', attribute: 'social' },
    { reference: 'intimidation', label: 'Intimidation', attribute: 'social' },
    { reference: 'deception', label: 'Deception', attribute: 'social' },
    { reference: 'etiquette', label: 'Etiquette', attribute: 'social' },
  ],

  resources: [{ reference: 'purse', label: 'Purse' }],

  /**
   * Named characters the plot turns on, then the archetypes the novel fills
   * its streets with. The generic archetypes cover anyone else the player
   * runs into. d'Artagnan is the player, not a definition.
   */
  npcs: [
    {
      reference: 'treville',
      label: 'M. de Tréville',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description:
        "Captain of the King's Musketeers, a Gascon who rose by his sword and guards his men jealously.",
    },
    {
      reference: 'athos',
      label: 'Athos',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description:
        'A musketeer of noble bearing, melancholic and sparing with words, feared with a blade.',
    },
    {
      reference: 'porthos',
      label: 'Porthos',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description: 'A musketeer, vain, loud and generous, as strong as he is proud of his baldric.',
    },
    {
      reference: 'aramis',
      label: 'Aramis',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description:
        'A musketeer with the manners of an abbé, discreet about his letters and his affairs of the heart.',
    },
    {
      reference: 'planchet',
      label: 'Planchet',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description: 'A resourceful Picard lackey, looking for a master who pays.',
    },
    {
      reference: 'rochefort',
      label: 'Rochefort',
      kind: 'unique',
      defaultDisposition: 'unfriendly',
      description:
        "The Cardinal's man, a gentleman with a scar on his temple and a contemptuous smile.",
    },
    {
      reference: 'milady',
      label: 'Milady',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description:
        "A pale, beautiful Englishwoman with a charming manner, and the Cardinal's most dangerous agent.",
    },
    {
      reference: 'jussac',
      label: 'Jussac',
      kind: 'unique',
      defaultDisposition: 'unfriendly',
      description: "An officer of the Cardinal's Guards, quick to provoke any musketeer.",
    },
    {
      reference: 'monsieur_bonacieux',
      label: 'M. Bonacieux',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description: 'A timid, grasping mercer who lets rooms in the Rue des Fossoyeurs.',
    },
    {
      reference: 'constance_bonacieux',
      label: 'Constance Bonacieux',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description: "The mercer's young wife, linen-maid and confidante of the Queen.",
    },
    {
      reference: 'richelieu',
      label: 'Cardinal Richelieu',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description: 'First minister of France, patient, cold and informed of everything.',
    },
    {
      reference: 'louis_xiii',
      label: 'King Louis XIII',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description:
        'The King of France, easily bored, proud of his musketeers, wary of his minister.',
    },
    {
      reference: 'anne_of_austria',
      label: 'Queen Anne of Austria',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description: 'The Queen of France, Spanish-born, watched closely by the Cardinal.',
    },
    {
      reference: 'buckingham',
      label: 'Duke of Buckingham',
      kind: 'unique',
      defaultDisposition: 'neutral',
      description:
        'The English favourite, dazzling and reckless, in love with the Queen of France.',
    },

    {
      reference: 'musketeer',
      label: 'Musketeer',
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'neutral',
      description:
        "A soldier of the King's Musketeers in his blue cloak, proud, idle and quarrelsome.",
    },
    {
      reference: 'cardinal_guard',
      label: "Cardinal's Guard",
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'unfriendly',
      description:
        "A soldier of the Cardinal's Guards in his red cloak, eager to catch a duellist.",
    },
    {
      reference: 'royal_guard',
      label: 'Royal Guard',
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'neutral',
      description: "A soldier of the King's Guards posted at the palace doors.",
    },

    {
      reference: 'commoner',
      label: 'Commoner',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      description: "Anyone of the common people: a shopkeeper's boy, a washerwoman, a porter.",
    },
    {
      reference: 'merchant',
      label: 'Merchant',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      description: 'A trader, shopkeeper or innkeeper with something to sell.',
    },
    {
      reference: 'servant',
      label: 'Servant',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      description: "A lackey, maid or groom in someone else's service.",
    },
    {
      reference: 'noble',
      label: 'Noble',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      description: 'A gentleman or lady of rank, touchy about precedence.',
    },
    {
      reference: 'clergyman',
      label: 'Clergyman',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      description: 'A priest, monk or abbé.',
    },
    {
      reference: 'soldier',
      label: 'Soldier',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      description: 'An armed man in service: a town watchman, a trooper, a sentry.',
    },
    {
      reference: 'thug',
      label: 'Thug',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'unfriendly',
      description: 'A brawler, cutpurse or hired blade who lives outside the law.',
    },
  ],

  /**
   * Named places at the grain of the novel, each set in the place that
   * contains it, under the two countries the story crosses. Moving within one
   * of them — from a tavern's common room to its stable — is not a movement.
   * The archetypes stand for any other place the player goes to.
   */
  locations: [
    {
      reference: 'france',
      label: 'France',
      kind: 'unique',
      parent: null,
      description: 'The Kingdom of France, from the Gascon hills to the Channel coast.',
    },
    {
      reference: 'england',
      label: 'England',
      kind: 'unique',
      parent: null,
      description: 'The Kingdom of England, across the Channel, at odds with France.',
    },
    {
      reference: 'meung_sur_loire',
      label: 'Meung-sur-Loire',
      kind: 'unique',
      parent: 'france',
      description: 'A small town on the Loire, on the road from Gascony to Paris.',
    },
    {
      reference: 'road_to_paris',
      label: 'The road to Paris',
      kind: 'unique',
      parent: 'france',
      description: 'The long highway north through the Loire country to the capital.',
    },
    {
      reference: 'paris',
      label: 'Paris',
      kind: 'unique',
      parent: 'france',
      description: 'The capital: crowded, muddy, and ruled by the King and the Cardinal.',
    },
    {
      reference: 'rue_des_fossoyeurs',
      label: 'Rue des Fossoyeurs',
      kind: 'unique',
      parent: 'paris',
      description: 'A quiet street where the mercer Bonacieux lets rooms.',
    },
    {
      reference: 'hotel_de_treville',
      label: 'Hôtel de Tréville',
      kind: 'unique',
      parent: 'paris',
      description: "Tréville's town house, its courtyard and stairs thronged with musketeers.",
    },
    {
      reference: 'carmes_deschaux',
      label: 'Carmes-Deschaux',
      kind: 'unique',
      parent: 'paris',
      description: 'Waste ground behind a convent, where gentlemen go to duel unseen.',
    },
    {
      reference: 'louvre',
      label: 'The Louvre',
      kind: 'unique',
      parent: 'paris',
      description: "The King's palace, guarded, gilded, and full of ears.",
    },
    {
      reference: 'palais_cardinal',
      label: 'Palais-Cardinal',
      kind: 'unique',
      parent: 'paris',
      description: "Richelieu's palace, where his Guards keep the doors.",
    },
    {
      reference: 'chantilly',
      label: 'Chantilly',
      kind: 'unique',
      parent: 'france',
      description: 'A town on the road north from Paris.',
    },
    {
      reference: 'amiens',
      label: 'Amiens',
      kind: 'unique',
      parent: 'france',
      description: 'A cathedral city of Picardy on the road to the coast.',
    },
    {
      reference: 'calais',
      label: 'Calais',
      kind: 'unique',
      parent: 'france',
      description: 'The port where ships cross to England, closely watched.',
    },
    {
      reference: 'london',
      label: 'London',
      kind: 'unique',
      parent: 'england',
      description: "The English capital on the Thames, seat of Buckingham's power.",
    },

    {
      reference: 'town',
      label: 'Town',
      kind: 'archetype',
      description: 'A town or village with a church, a market and a few streets.',
    },
    {
      reference: 'road',
      label: 'Road',
      kind: 'archetype',
      description: 'A stretch of road or track between two places.',
    },
    {
      reference: 'forest',
      label: 'Forest',
      kind: 'archetype',
      description: 'Woodland, a clearing, or a lane through the trees.',
    },
    {
      reference: 'alley',
      label: 'Alley',
      kind: 'archetype',
      description: 'A narrow, dark lane between houses.',
    },
    {
      reference: 'tavern',
      label: 'Tavern',
      kind: 'archetype',
      description: 'A place to eat and drink, loud and crowded.',
    },
    {
      reference: 'inn',
      label: 'Inn',
      kind: 'archetype',
      description: 'A place to sleep and stable horses on the road.',
    },
    {
      reference: 'residence',
      label: 'Residence',
      kind: 'archetype',
      description: "A private house, from a lodging to a nobleman's mansion.",
    },
    {
      reference: 'church',
      label: 'Church',
      kind: 'archetype',
      description: 'A church, chapel or convent.',
    },
    {
      reference: 'port',
      label: 'Port',
      kind: 'archetype',
      description: 'A harbour, its quays and its ships.',
    },
  ],

  chapters: [{ reference: 'the_road_to_paris', label: 'The Road to Paris' }],

  quests: [{ reference: 'deliver_the_letter', label: 'Deliver the letter' }],
}

export function skillReferences(world: WorldDefinition): string[] {
  return world.skills.map((skill) => skill.reference)
}

/** Every person the model may bring into a scene, unique or archetype. */
export function npcReferences(world: WorldDefinition): string[] {
  return world.npcs.map((npc) => npc.reference)
}

/**
 * Named places: the only destinations a movement may name directly, and the
 * parents an improvised place may hang from.
 */
export function uniqueLocationReferences(world: WorldDefinition): string[] {
  return world.locations
    .filter((location) => location.kind === 'unique')
    .map((location) => location.reference)
}

/** Generic places an improvised location is an instance of. */
export function locationArchetypeReferences(world: WorldDefinition): string[] {
  return world.locations
    .filter((location) => location.kind === 'archetype')
    .map((location) => location.reference)
}
