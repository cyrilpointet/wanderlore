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

export type WorldSkill = {
  name: string
  attribute: string
}

export type WorldDefinition = {
  reference: string
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
  attributes: string[]
  skills: WorldSkill[]
}

export const THREE_MUSKETEERS: WorldDefinition = {
  reference: 'three_musketeers',

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

  attributes: ['Physical', 'Mental', 'Social'],

  /**
   * Flat and short on purpose: the rules document warns that the simpler the
   * skill list, the more reliably the arbitration step resolves an action onto
   * exactly one of them.
   */
  skills: [
    { name: 'swordsmanship', attribute: 'Physical' },
    { name: 'athletics', attribute: 'Physical' },
    { name: 'stealth', attribute: 'Physical' },
    { name: 'marksmanship', attribute: 'Physical' },
    { name: 'observation', attribute: 'Mental' },
    { name: 'scholarship', attribute: 'Mental' },
    { name: 'persuasion', attribute: 'Social' },
    { name: 'intimidation', attribute: 'Social' },
    { name: 'deception', attribute: 'Social' },
    { name: 'etiquette', attribute: 'Social' },
  ],
}

export function skillNames(world: WorldDefinition): string[] {
  return world.skills.map((skill) => skill.name)
}
