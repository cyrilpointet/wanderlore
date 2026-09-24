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
   * Closed list: a movement the model proposes must land on one of these, or
   * the turn is rejected. A place it made up would have no label to show.
   */
  locations: ContentEntry[]
  chapters: ContentEntry[]
  quests: ContentEntry[]
}

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
   * Places the story actually turns on, at the grain of the novel. Moving
   * within one of them — from a tavern's common room to its stable — is not a
   * movement.
   */
  locations: [
    { reference: 'meung_sur_loire', label: 'Meung-sur-Loire' },
    { reference: 'road_to_paris', label: 'The road to Paris' },
    { reference: 'paris', label: 'Paris' },
    { reference: 'rue_des_fossoyeurs', label: 'Rue des Fossoyeurs' },
    { reference: 'hotel_de_treville', label: 'Hôtel de Tréville' },
    { reference: 'carmes_deschaux', label: 'Carmes-Deschaux' },
    { reference: 'louvre', label: 'The Louvre' },
    { reference: 'palais_cardinal', label: 'Palais-Cardinal' },
    { reference: 'chantilly', label: 'Chantilly' },
    { reference: 'amiens', label: 'Amiens' },
    { reference: 'calais', label: 'Calais' },
    { reference: 'london', label: 'London' },
  ],

  chapters: [{ reference: 'the_road_to_paris', label: 'The Road to Paris' }],

  quests: [{ reference: 'deliver_the_letter', label: 'Deliver the letter' }],
}

export function skillReferences(world: WorldDefinition): string[] {
  return world.skills.map((skill) => skill.reference)
}

export function locationReferences(world: WorldDefinition): string[] {
  return world.locations.map((location) => location.reference)
}
