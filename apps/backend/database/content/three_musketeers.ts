import type { WorldContent } from '#services/game/content/types'

/**
 * *The Three Musketeers*, as the content seeder writes it to the database.
 *
 * The first world of the game, leaning on a novel the model already knows: no
 * lore corpus of its own. Public domain, so the intellectual-property caveat
 * the roadmap raises about borrowed settings does not apply.
 *
 * Everything is in English, labels included: only the narration is ever
 * produced in the player's language. Every definition lives at world level;
 * the one scenario adds none of its own.
 *
 * On the BRP rules: skills in percent, with the base chances of the book;
 * weapons with its damage dice. A world may name its skills its own way — one
 * swordsmanship skill stands for the book's Melee Weapon (Sword).
 */
export const THREE_MUSKETEERS_CONTENT: WorldContent = {
  reference: 'three_musketeers',
  labels: { en: 'The Three Musketeers' },
  narrativeTone:
    'France, 1625: cloak-and-dagger adventure, court intrigue, honour and hot tempers.',
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
  /**
   * Flat and short on purpose: the rules document warns that the simpler the
   * skill list, the more reliably the arbitration step resolves an action onto
   * exactly one of them.
   */
  skills: [
    {
      reference: 'swordsmanship',
      labels: { en: 'Swordsmanship' },
      category: 'combat',
      baseChance: 15,
    },
    { reference: 'athletics', labels: { en: 'Athletics' }, category: 'physical', baseChance: 25 },
    { reference: 'stealth', labels: { en: 'Stealth' }, category: 'physical', baseChance: 10 },
    {
      reference: 'marksmanship',
      labels: { en: 'Marksmanship' },
      category: 'combat',
      baseChance: 20,
    },
    {
      reference: 'observation',
      labels: { en: 'Observation' },
      category: 'perception',
      baseChance: 25,
    },
    { reference: 'scholarship', labels: { en: 'Scholarship' }, category: 'mental', baseChance: 5 },
    {
      reference: 'persuasion',
      labels: { en: 'Persuasion' },
      category: 'communication',
      baseChance: 15,
    },
    {
      reference: 'intimidation',
      labels: { en: 'Intimidation' },
      category: 'communication',
      baseChance: 5,
    },
    {
      reference: 'deception',
      labels: { en: 'Deception' },
      category: 'communication',
      baseChance: 5,
    },
    {
      reference: 'etiquette',
      labels: { en: 'Etiquette' },
      category: 'communication',
      baseChance: 5,
    },
  ],
  resources: [{ reference: 'purse', labels: { en: 'Purse' } }],
  glossary: [],
  /**
   * One category per use of each skill. The rules document warns that the
   * fewer and flatter the categories, the more reliably arbitration lands an
   * action on exactly one of them.
   */
  actionTypes: [
    {
      actionType: 'melee_combat',
      description:
        'Fighting at close quarters, with a sword, a dagger, bare fists or whatever is at hand.',
      associatedSkill: 'swordsmanship',
      associatedCharacteristic: null,
    },
    {
      actionType: 'ranged_combat',
      description: 'Shooting or throwing at a target: pistol, musket, thrown knife or stone.',
      associatedSkill: 'marksmanship',
      associatedCharacteristic: null,
    },
    {
      actionType: 'physical_feat',
      description:
        'Climbing, jumping, running, swimming, riding hard, or forcing a door by strength.',
      associatedSkill: 'athletics',
      associatedCharacteristic: null,
    },
    {
      actionType: 'sneaking',
      description: 'Moving unseen or unheard, hiding, shadowing someone, or lifting a purse.',
      associatedSkill: 'stealth',
      associatedCharacteristic: null,
    },
    {
      actionType: 'perception',
      description: 'Noticing, searching, spotting a detail or a lie, or reading a scene.',
      associatedSkill: 'observation',
      associatedCharacteristic: null,
    },
    {
      actionType: 'knowledge',
      description:
        'Recalling or working out what learning teaches: law, heraldry, history, medicine, a cipher.',
      associatedSkill: 'scholarship',
      associatedCharacteristic: null,
    },
    {
      actionType: 'social_persuasion',
      description: 'Winning someone over by argument, charm or an appeal to their interest.',
      associatedSkill: 'persuasion',
      associatedCharacteristic: null,
    },
    {
      actionType: 'social_intimidation',
      description: "Getting one's way through threats, menace or sheer force of presence.",
      associatedSkill: 'intimidation',
      associatedCharacteristic: null,
    },
    {
      actionType: 'social_deception',
      description: "Lying, bluffing, or disguising oneself or one's intentions.",
      associatedSkill: 'deception',
      associatedCharacteristic: null,
    },
    {
      actionType: 'social_etiquette',
      description: 'Behaving as rank and custom demand: at court, before a superior, among nobles.',
      associatedSkill: 'etiquette',
      associatedCharacteristic: null,
    },
  ],
  /**
   * Named characters the plot turns on, then the archetypes the novel fills
   * its streets with. The generic archetypes cover anyone else the player
   * runs into. d'Artagnan is the player, not a definition.
   *
   * Profiles on the scale of the book's people: a dozen hit points for an
   * ordinary adult, 14 to 16 for a fighting man, 10 or 11 for the frail;
   * 30 to 45% for a hand, 60 to 75% for a veteran, 90% for the best blade of
   * the regiment.
   */
  npcs: [
    {
      reference: 'treville',
      labels: { en: 'M. de Tréville' },
      description:
        "Captain of the King's Musketeers, a Gascon who rose by his sword and guards his men jealously.",
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 75, persuasion: 60, intimidation: 60, observation: 60 },
        hitPointsMax: 14,
        weapon: 'rapier',
      },
    },
    {
      reference: 'athos',
      labels: { en: 'Athos' },
      description:
        'A musketeer of noble bearing, melancholic and sparing with words, feared with a blade.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 90, observation: 60, etiquette: 60 },
        hitPointsMax: 14,
        weapon: 'rapier',
      },
    },
    {
      reference: 'porthos',
      labels: { en: 'Porthos' },
      description: 'A musketeer, vain, loud and generous, as strong as he is proud of his baldric.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 75, athletics: 75, intimidation: 60 },
        hitPointsMax: 16,
        weapon: 'rapier',
      },
    },
    {
      reference: 'aramis',
      labels: { en: 'Aramis' },
      description:
        'A musketeer with the manners of an abbé, discreet about his letters and his affairs of the heart.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 75, deception: 60, scholarship: 60 },
        hitPointsMax: 13,
        weapon: 'rapier',
      },
    },
    {
      reference: 'planchet',
      labels: { en: 'Planchet' },
      description: 'A resourceful Picard lackey, looking for a master who pays.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { stealth: 45, athletics: 45, observation: 45 },
        hitPointsMax: 11,
        weapon: null,
      },
    },
    {
      reference: 'rochefort',
      labels: { en: 'Rochefort' },
      description:
        "The Cardinal's man, a gentleman with a scar on his temple and a contemptuous smile.",
      kind: 'unique',
      generic: false,
      defaultDisposition: 'unfriendly',
      combat: {
        skills: { swordsmanship: 75, deception: 60, intimidation: 60 },
        hitPointsMax: 14,
        weapon: 'rapier',
      },
    },
    {
      reference: 'milady',
      labels: { en: 'Milady' },
      description:
        "A pale, beautiful Englishwoman with a charming manner, and the Cardinal's most dangerous agent.",
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { deception: 90, persuasion: 75, stealth: 60 },
        hitPointsMax: 11,
        weapon: 'dagger',
      },
    },
    {
      reference: 'jussac',
      labels: { en: 'Jussac' },
      description: "An officer of the Cardinal's Guards, quick to provoke any musketeer.",
      kind: 'unique',
      generic: false,
      defaultDisposition: 'unfriendly',
      combat: {
        skills: { swordsmanship: 75, intimidation: 45 },
        hitPointsMax: 13,
        weapon: 'rapier',
      },
    },
    {
      reference: 'monsieur_bonacieux',
      labels: { en: 'M. Bonacieux' },
      description: 'A timid, grasping mercer who lets rooms in the Rue des Fossoyeurs.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: { skills: { deception: 30, observation: 30 }, hitPointsMax: 10, weapon: null },
    },
    {
      reference: 'constance_bonacieux',
      labels: { en: 'Constance Bonacieux' },
      description: "The mercer's young wife, linen-maid and confidante of the Queen.",
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: { skills: { stealth: 45, persuasion: 45 }, hitPointsMax: 10, weapon: null },
    },
    {
      reference: 'richelieu',
      labels: { en: 'Cardinal Richelieu' },
      description: 'First minister of France, patient, cold and informed of everything.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { persuasion: 75, deception: 75, observation: 75, intimidation: 75 },
        hitPointsMax: 11,
        weapon: null,
      },
    },
    {
      reference: 'louis_xiii',
      labels: { en: 'King Louis XIII' },
      description:
        'The King of France, easily bored, proud of his musketeers, wary of his minister.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: { skills: { etiquette: 75, marksmanship: 45 }, hitPointsMax: 12, weapon: null },
    },
    {
      reference: 'anne_of_austria',
      labels: { en: 'Queen Anne of Austria' },
      description: 'The Queen of France, Spanish-born, watched closely by the Cardinal.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: { skills: { etiquette: 75, persuasion: 60 }, hitPointsMax: 11, weapon: null },
    },
    {
      reference: 'buckingham',
      labels: { en: 'Duke of Buckingham' },
      description:
        'The English favourite, dazzling and reckless, in love with the Queen of France.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 60, persuasion: 75, etiquette: 75 },
        hitPointsMax: 13,
        weapon: 'rapier',
      },
    },
    {
      reference: 'musketeer',
      labels: { en: 'Musketeer' },
      description:
        "A soldier of the King's Musketeers in his blue cloak, proud, idle and quarrelsome.",
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 60, athletics: 45, marksmanship: 45 },
        hitPointsMax: 13,
        weapon: 'rapier',
      },
    },
    {
      reference: 'cardinal_guard',
      labels: { en: "Cardinal's Guard" },
      description:
        "A soldier of the Cardinal's Guards in his red cloak, eager to catch a duellist.",
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'unfriendly',
      combat: {
        skills: { swordsmanship: 60, intimidation: 45, marksmanship: 45 },
        hitPointsMax: 13,
        weapon: 'rapier',
      },
    },
    {
      reference: 'royal_guard',
      labels: { en: 'Royal Guard' },
      description: "A soldier of the King's Guards posted at the palace doors.",
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 45, observation: 45 },
        hitPointsMax: 12,
        weapon: 'common_sword',
      },
    },
    {
      reference: 'commoner',
      labels: { en: 'Commoner' },
      description: "Anyone of the common people: a shopkeeper's boy, a washerwoman, a porter.",
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: { skills: { athletics: 30 }, hitPointsMax: 10, weapon: null },
    },
    {
      reference: 'merchant',
      labels: { en: 'Merchant' },
      description: 'A trader, shopkeeper or innkeeper with something to sell.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: { skills: { persuasion: 45, observation: 30 }, hitPointsMax: 10, weapon: null },
    },
    {
      reference: 'servant',
      labels: { en: 'Servant' },
      description: "A lackey, maid or groom in someone else's service.",
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: { skills: { stealth: 30, observation: 30 }, hitPointsMax: 10, weapon: null },
    },
    {
      reference: 'noble',
      labels: { en: 'Noble' },
      description: 'A gentleman or lady of rank, touchy about precedence.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: { skills: { etiquette: 60, swordsmanship: 45 }, hitPointsMax: 11, weapon: 'rapier' },
    },
    {
      reference: 'clergyman',
      labels: { en: 'Clergyman' },
      description: 'A priest, monk or abbé.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: { skills: { scholarship: 60, persuasion: 45 }, hitPointsMax: 10, weapon: null },
    },
    {
      reference: 'soldier',
      labels: { en: 'Soldier' },
      description: 'An armed man in service: a town watchman, a trooper, a sentry.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: {
        skills: { swordsmanship: 45, marksmanship: 45, athletics: 45 },
        hitPointsMax: 12,
        weapon: 'common_sword',
      },
    },
    {
      reference: 'thug',
      labels: { en: 'Thug' },
      description: 'A brawler, cutpurse or hired blade who lives outside the law.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'unfriendly',
      combat: {
        skills: { swordsmanship: 45, intimidation: 45, stealth: 45 },
        hitPointsMax: 11,
        weapon: 'dagger',
      },
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
      labels: { en: 'France' },
      description: 'The Kingdom of France, from the Gascon hills to the Channel coast.',
      kind: 'unique',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'england',
      labels: { en: 'England' },
      description: 'The Kingdom of England, across the Channel, at odds with France.',
      kind: 'unique',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'meung_sur_loire',
      labels: { en: 'Meung-sur-Loire' },
      description: 'A small town on the Loire, on the road from Gascony to Paris.',
      kind: 'unique',
      parent: 'france',
      exits: [],
      entrance: false,
    },
    {
      reference: 'road_to_paris',
      labels: { en: 'The road to Paris' },
      description: 'The long highway north through the Loire country to the capital.',
      kind: 'unique',
      parent: 'france',
      exits: [],
      entrance: false,
    },
    {
      reference: 'paris',
      labels: { en: 'Paris' },
      description: 'The capital: crowded, muddy, and ruled by the King and the Cardinal.',
      kind: 'unique',
      parent: 'france',
      exits: [],
      entrance: false,
    },
    {
      reference: 'rue_des_fossoyeurs',
      labels: { en: 'Rue des Fossoyeurs' },
      description: 'A quiet street where the mercer Bonacieux lets rooms.',
      kind: 'unique',
      parent: 'paris',
      exits: [],
      entrance: false,
    },
    {
      reference: 'hotel_de_treville',
      labels: { en: 'Hôtel de Tréville' },
      description: "Tréville's town house, its courtyard and stairs thronged with musketeers.",
      kind: 'unique',
      parent: 'paris',
      exits: [],
      entrance: false,
    },
    {
      reference: 'carmes_deschaux',
      labels: { en: 'Carmes-Deschaux' },
      description: 'Waste ground behind a convent, where gentlemen go to duel unseen.',
      kind: 'unique',
      parent: 'paris',
      exits: [],
      entrance: false,
    },
    {
      reference: 'louvre',
      labels: { en: 'The Louvre' },
      description: "The King's palace, guarded, gilded, and full of ears.",
      kind: 'unique',
      parent: 'paris',
      exits: [],
      entrance: false,
    },
    {
      reference: 'palais_cardinal',
      labels: { en: 'Palais-Cardinal' },
      description: "Richelieu's palace, where his Guards keep the doors.",
      kind: 'unique',
      parent: 'paris',
      exits: [],
      entrance: false,
    },
    {
      reference: 'chantilly',
      labels: { en: 'Chantilly' },
      description: 'A town on the road north from Paris.',
      kind: 'unique',
      parent: 'france',
      exits: [],
      entrance: false,
    },
    {
      reference: 'amiens',
      labels: { en: 'Amiens' },
      description: 'A cathedral city of Picardy on the road to the coast.',
      kind: 'unique',
      parent: 'france',
      exits: [],
      entrance: false,
    },
    {
      reference: 'calais',
      labels: { en: 'Calais' },
      description: 'The port where ships cross to England, closely watched.',
      kind: 'unique',
      parent: 'france',
      exits: [],
      entrance: false,
    },
    {
      reference: 'london',
      labels: { en: 'London' },
      description: "The English capital on the Thames, seat of Buckingham's power.",
      kind: 'unique',
      parent: 'england',
      exits: [],
      entrance: false,
    },
    {
      reference: 'town',
      labels: { en: 'Town' },
      description: 'A town or village with a church, a market and a few streets.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'road',
      labels: { en: 'Road' },
      description: 'A stretch of road or track between two places.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'forest',
      labels: { en: 'Forest' },
      description: 'Woodland, a clearing, or a lane through the trees.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'alley',
      labels: { en: 'Alley' },
      description: 'A narrow, dark lane between houses.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'tavern',
      labels: { en: 'Tavern' },
      description: 'A place to eat and drink, loud and crowded.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'inn',
      labels: { en: 'Inn' },
      description: 'A place to sleep and stable horses on the road.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'residence',
      labels: { en: 'Residence' },
      description: "A private house, from a lodging to a nobleman's mansion.",
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'church',
      labels: { en: 'Church' },
      description: 'A church, chapel or convent.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'port',
      labels: { en: 'Port' },
      description: 'A harbour, its quays and its ships.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
  ],
  /**
   * The items the plot turns on, then the arms and gear of the novel, then
   * generic archetypes for anything else the player picks up. Modifiers are
   * in percent, as BRP prices equipment; weapons carry the dice of the book.
   */
  items: [
    {
      reference: 'letter_to_treville',
      labels: { en: 'Letter for M. de Tréville' },
      description:
        "A letter of recommendation from d'Artagnan's father to his old comrade, the captain of the Musketeers.",
      kind: 'unique',
      generic: false,
      stackable: false,
      equippable: false,
      modifiers: [
        {
          target: 'skill',
          skill: 'persuasion',
          value: 10,
          condition: 'owned',
          description: 'A gentleman vouched for by an old friend of Tréville',
        },
      ],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'queens_diamond_studs',
      labels: { en: "The Queen's diamond studs" },
      description:
        'Twelve diamond studs the King gave the Queen, which she secretly gave the Duke of Buckingham.',
      kind: 'unique',
      generic: false,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      initialHolder: { holder: 'npc', reference: 'buckingham' },
    },
    {
      reference: 'richelieu_warrant',
      labels: { en: "The Cardinal's warrant" },
      description:
        "A paper in Richelieu's hand stating that the bearer acted on his orders and for the good of the State.",
      kind: 'unique',
      generic: false,
      stackable: false,
      equippable: false,
      modifiers: [
        {
          target: 'skill',
          skill: 'intimidation',
          value: 20,
          condition: 'owned',
          description: "The Cardinal's own signature covers the bearer",
        },
      ],
      weapon: null,
      initialHolder: { holder: 'npc', reference: 'milady' },
    },
    {
      reference: 'cardinal_seal',
      labels: { en: "The Cardinal's seal" },
      description: "A signet bearing Richelieu's arms, used to seal his orders.",
      kind: 'unique',
      generic: false,
      stackable: false,
      equippable: false,
      modifiers: [
        {
          target: 'skill',
          skill: 'deception',
          value: 20,
          condition: 'owned',
          description: 'Forged orders carry a genuine seal',
        },
      ],
      weapon: null,
      initialHolder: { holder: 'location', reference: 'palais_cardinal' },
    },
    {
      reference: 'rapier',
      labels: { en: 'Rapier' },
      description: 'A long, slender duelling sword, the weapon of every gentleman.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        skill: 'swordsmanship',
        damage: '1D6+1',
        damageModifier: 'full',
        special: 'impaling',
      },
      initialHolder: null,
    },
    {
      reference: 'dagger',
      labels: { en: 'Dagger' },
      description: 'A short blade, a main-gauche or a knife worn at the belt.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        skill: 'swordsmanship',
        damage: '1D4+2',
        damageModifier: 'full',
        special: 'impaling',
      },
      initialHolder: null,
    },
    {
      reference: 'pistol',
      labels: { en: 'Pistol' },
      description: 'A single-shot wheellock pistol, slow to reload.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        skill: 'marksmanship',
        damage: '1D6+1',
        damageModifier: 'none',
        special: 'impaling',
      },
      initialHolder: null,
    },
    {
      reference: 'musket',
      labels: { en: 'Musket' },
      description: 'A long, heavy matchlock musket, deadly and cumbersome.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [
        {
          target: 'skill',
          skill: 'stealth',
          value: -10,
          condition: 'equipped',
          description: 'A long, smoking matchlock is hard to hide',
        },
      ],
      weapon: {
        skill: 'marksmanship',
        damage: '1D10+4',
        damageModifier: 'none',
        special: 'impaling',
      },
      initialHolder: null,
    },
    {
      reference: 'musketeer_tabard',
      labels: { en: "Musketeer's tabard" },
      description: "The blue tabard with the silver cross of the King's Musketeers.",
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [
        {
          target: 'skill',
          skill: 'intimidation',
          value: 10,
          condition: 'equipped',
          description: "Wearing the King's colours",
        },
      ],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'improvised_weapon',
      labels: { en: 'Improvised weapon' },
      description: 'Anything picked up to hit with: a stool, a bottle, a candlestick, a stick.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        skill: 'swordsmanship',
        damage: '1D6',
        damageModifier: 'full',
        special: 'crushing',
      },
      initialHolder: null,
    },
    {
      reference: 'common_sword',
      labels: { en: 'Sword' },
      description: "Any plain sword: a soldier's blade, a sabre, a sword taken from a fallen foe.",
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        skill: 'swordsmanship',
        damage: '1D8+1',
        damageModifier: 'full',
        special: 'bleeding',
      },
      initialHolder: null,
    },
    {
      reference: 'rope',
      labels: { en: 'Rope' },
      description: 'A coil of rope or cord.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [
        {
          target: 'skill',
          skill: 'athletics',
          value: 10,
          condition: 'owned',
          description: 'A rope to climb or swing with',
        },
      ],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'tool',
      labels: { en: 'Tool' },
      description: 'A key, a lantern, a crowbar or any other implement.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'document',
      labels: { en: 'Document' },
      description: 'A letter, a note, a map or any paper of no particular weight.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'trinket',
      labels: { en: 'Trinket' },
      description: 'A small valuable: a ring, a locket, a handkerchief, a jewel.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'food',
      labels: { en: 'Food' },
      description: 'A ration of food or a bottle of wine.',
      kind: 'archetype',
      generic: true,
      stackable: true,
      equippable: false,
      modifiers: [],
      weapon: null,
      initialHolder: null,
    },
    {
      reference: 'lead_shot',
      labels: { en: 'Lead shot' },
      description: 'Lead balls and powder for a pistol or a musket, one shot each.',
      kind: 'archetype',
      generic: true,
      stackable: true,
      equippable: false,
      modifiers: [],
      weapon: null,
      initialHolder: null,
    },
  ],
  scenarios: [
    {
      reference: 'a_gascon_in_paris',
      labels: { en: 'A Gascon in Paris' },
      synopsis:
        "1625. Young d'Artagnan leaves Gascony for Paris with his father's sword, fifteen écus and a letter for M. de Tréville, captain of the King's Musketeers. The road is long, tempers are short, and the Cardinal's men are everywhere.",
      status: 'published',
      chapters: [{ reference: 'the_road_to_paris', labels: { en: 'The Road to Paris' } }],
      quests: [{ reference: 'deliver_the_letter', labels: { en: 'Deliver the letter' } }],
      pregeneratedCharacter: {
        name: "d'Artagnan",
        /** Quick, hot-headed and charming: a young Gascon of eighteen. */
        characteristics: { STR: 13, CON: 14, SIZ: 12, INT: 13, POW: 12, DEX: 16, CHA: 14 },
        skills: {
          swordsmanship: 60,
          athletics: 30,
          observation: 30,
          persuasion: 45,
          etiquette: 30,
        },
        resources: { purse: 15 },
        /**
         * What d'Artagnan leaves Gascony with: his father's letter for
         * Tréville, and his father's old sword at his side. His purse is a
         * resource, not an item.
         */
        items: [
          { definition: 'letter_to_treville', descriptor: null, quantity: 1, equipped: false },
          {
            definition: 'rapier',
            descriptor: "his father's old sword, long and a little out of fashion",
            quantity: 1,
            equipped: true,
          },
        ],
      },
      /** The story opens in Meung, the first place the game goes through. */
      initialState: {
        location: 'meung_sur_loire',
        chapter: 'the_road_to_paris',
        quests: [
          {
            reference: 'deliver_the_letter',
            step: 1,
            summary: 'Carry your father’s letter to Monsieur de Tréville.',
          },
        ],
      },
      /** Dumas: « le premier lundi du mois d'avril 1625 », as d'Artagnan rides into Meung. */
      startTime: '10:00',
      startDate: '1625-04-07',
      glossary: [],
      npcs: [],
      locations: [],
      items: [],
    },
  ],
}
