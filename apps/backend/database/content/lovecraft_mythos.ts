import type { WorldContent } from '#services/game/content/types'

/**
 * H. P. Lovecraft's Mythos, as the content seeder writes it to the database.
 *
 * Like the first world, it leans on fiction the model already knows: no lore
 * corpus of its own. Lovecraft died in 1937, and his work has been in the
 * public domain in Europe since 2008.
 *
 * The world carries what its scenarios share — the 1920s, the rules of
 * cosmic horror, the skills, the generic archetypes and the creatures of the
 * Mythos. Each scenario brings its own cast, places and items. Tone, rules and
 * ambiance are all the model reads of the world, so they are not tied to New
 * England, where *The Ward Inheritance* is set.
 *
 * Everything is in English except the French labels: only the narration is
 * ever produced in the player's language.
 */
export const LOVECRAFT_MYTHOS_CONTENT: WorldContent = {
  reference: 'lovecraft_mythos',
  labels: { en: 'The Lovecraft Mythos', fr: 'Le Mythe de Lovecraft' },
  narrativeTone:
    '1920s cosmic horror: slow-building dread, knowledge that costs, and a universe vast, ancient and indifferent to mankind.',
  /** Ordinary people against what they cannot understand: the book's normal level. */
  powerLevel: 'normal',
  /**
   * Without tags: sent with every turn, the rules to arbitration, the ambiance
   * to the narrator.
   */
  lore: [
    {
      reference: 'supernatural_is_rare',
      kind: 'rule',
      content:
        'The supernatural is real but rare, alien and never benevolent. It answers to no hero and offers no wonder without a price.',
      tags: [],
      secret: false,
    },
    {
      reference: 'no_magic_at_call',
      kind: 'rule',
      content:
        'There is no magic at the call of the characters: a rite or a formula comes from a forbidden text, takes time and preparation, and always costs the one who uses it.',
      tags: [],
      secret: false,
    },
    {
      reference: 'creatures_outmatch',
      kind: 'rule',
      content:
        'The creatures of the Mythos far outmatch ordinary people. Bullets wound them but rarely stop them; flight, hiding and wits save more lives than fighting.',
      tags: [],
      secret: false,
    },
    {
      reference: 'unnatural_shakes_mind',
      kind: 'rule',
      content:
        'Facing the unnatural shakes the mind as a blow shakes the body: a dreadful sight or revelation can cost hit points, and nerve fails before it.',
      tags: [],
      secret: false,
    },
    {
      reference: 'reality_unravels',
      kind: 'rule',
      content:
        'Where the Outer Gods are invoked, reality comes apart little by little: distances shift, time slips, rooms and faces are not what they were. The closer a rite comes to completion, the worse it grows.',
      tags: [],
      secret: false,
    },
    {
      reference: 'the_1920s',
      kind: 'rule',
      content:
        'This is the 1920s: telegraph and wireless, steamships, a few motor cars, revolvers and shotguns. Prohibition is in force in the United States.',
      tags: [],
      secret: false,
    },
    {
      reference: 'disbelief',
      kind: 'rule',
      content:
        'The authorities and the learned dismiss tales of the uncanny. Proof is hard to keep, and harder still to make anyone believe.',
      tags: [],
      secret: false,
    },
    {
      reference: 'isolation',
      kind: 'rule',
      content: 'Travel takes days and help is far away: the isolated stay isolated.',
      tags: [],
      secret: false,
    },
    {
      reference: 'fog_and_lichen',
      kind: 'ambiance',
      content:
        'Fog off the sea, old stone furred with lichen, the smell of brine, mildew and something rotten beneath.',
      tags: [],
      secret: false,
    },
    {
      reference: 'cyclopean_masonry',
      kind: 'ambiance',
      content:
        'Cyclopean masonry: monoliths too vast for human hands, at angles that seem at once convex and concave.',
      tags: [],
      secret: false,
    },
    {
      reference: 'sounds_below_hearing',
      kind: 'ambiance',
      content:
        'Sounds just below hearing — a far piping, a chant, a wet slither — that stop the moment anyone listens.',
      tags: [],
      secret: false,
    },
    {
      reference: 'decaying_new_england',
      kind: 'ambiance',
      content:
        'Decaying New England: gambrel roofs, shuttered windows, hollow-eyed farmhouses and villagers who say less than they know.',
      tags: [],
      secret: false,
    },
    {
      reference: 'the_ocean',
      kind: 'ambiance',
      content:
        'The ocean is vast, cold and older than anything that walks; it keeps what it takes.',
      tags: [],
      secret: false,
    },
    {
      reference: 'world_wears_thin',
      kind: 'ambiance',
      content:
        'Near a place where the Outer Gods have been called, the world wears thin: clocks disagree, a corridor runs longer than the house, a familiar face is wrong for an instant.',
      tags: [],
      secret: false,
    },
  ],
  /**
   * Flat and short, as in the first world, with the base chances of BRP.
   * `composure` stands where a sanity score would: the nerve to face the
   * unnatural is rolled, and what it costs comes off hit points — until BRP's
   * own sanity rules arrive with the optional rules (Phase 13).
   */
  skills: [
    {
      reference: 'brawling',
      labels: { en: 'Brawling', fr: 'Corps à corps' },
      category: 'combat',
      baseChance: 25,
    },
    {
      reference: 'firearms',
      labels: { en: 'Firearms', fr: 'Armes à feu' },
      category: 'combat',
      baseChance: 20,
    },
    {
      reference: 'athletics',
      labels: { en: 'Athletics', fr: 'Athlétisme' },
      category: 'physical',
      baseChance: 25,
    },
    {
      reference: 'stealth',
      labels: { en: 'Stealth', fr: 'Discrétion' },
      category: 'physical',
      baseChance: 10,
    },
    {
      reference: 'observation',
      labels: { en: 'Observation', fr: 'Observation' },
      category: 'perception',
      baseChance: 25,
    },
    {
      reference: 'scholarship',
      labels: { en: 'Scholarship', fr: 'Érudition' },
      category: 'mental',
      baseChance: 5,
    },
    {
      reference: 'occultism',
      labels: { en: 'Occultism', fr: 'Occultisme' },
      category: 'mental',
      baseChance: 5,
    },
    {
      reference: 'composure',
      labels: { en: 'Composure', fr: 'Sang-froid' },
      category: 'mental',
      baseChance: { characteristic: 'POW', multiplier: 2 },
    },
    {
      reference: 'survival',
      labels: { en: 'Survival', fr: 'Survie' },
      category: 'perception',
      baseChance: 10,
    },
    {
      reference: 'persuasion',
      labels: { en: 'Persuasion', fr: 'Persuasion' },
      category: 'communication',
      baseChance: 15,
    },
    {
      reference: 'intimidation',
      labels: { en: 'Intimidation', fr: 'Intimidation' },
      category: 'communication',
      baseChance: 5,
    },
    {
      reference: 'deception',
      labels: { en: 'Deception', fr: 'Tromperie' },
      category: 'communication',
      baseChance: 5,
    },
    /** Known to the system: the other way to meet a blow, besides the parry. */
    {
      reference: 'dodge',
      labels: { en: 'Dodge', fr: 'Esquive' },
      category: 'physical',
      baseChance: { characteristic: 'DEX', multiplier: 2 },
    },
    {
      reference: 'first_aid',
      labels: { en: 'First Aid', fr: 'Premiers soins' },
      category: 'manipulation',
      baseChance: 30,
    },
  ],
  resources: [{ reference: 'money', labels: { en: 'Dollars', fr: 'Dollars' } }],
  /** The gods, places and books people speak of, none of them met in play. */
  glossary: [
    { reference: 'cthulhu', labels: { en: 'Cthulhu', fr: 'Cthulhu' } },
    { reference: 'rlyeh', labels: { en: "R'lyeh", fr: "R'lyeh" } },
    { reference: 'dagon', labels: { en: 'Dagon', fr: 'Dagon' } },
    { reference: 'mother_hydra', labels: { en: 'Mother Hydra', fr: 'Mère Hydra' } },
    { reference: 'azathoth', labels: { en: 'Azathoth', fr: 'Azathoth' } },
    { reference: 'yog_sothoth', labels: { en: 'Yog-Sothoth', fr: 'Yog-Sothoth' } },
    { reference: 'nyarlathotep', labels: { en: 'Nyarlathotep', fr: 'Nyarlathotep' } },
    { reference: 'outer_gods', labels: { en: 'the Outer Gods', fr: 'les Dieux Extérieurs' } },
    {
      reference: 'miskatonic_university',
      labels: { en: 'Miskatonic University', fr: "l'université Miskatonic" },
    },
    { reference: 'innsmouth', labels: { en: 'Innsmouth', fr: 'Innsmouth' } },
    { reference: 'abdul_alhazred', labels: { en: 'Abdul Alhazred', fr: 'Abdul Alhazred' } },
  ],
  /** One category per use of each skill, as in the first world. */
  actionTypes: [
    {
      actionType: 'melee_combat',
      description:
        'Fighting at close quarters: fists, a knife, a club, a rifle butt or whatever is at hand.',
      associatedSkill: 'brawling',
      associatedCharacteristic: null,
    },
    {
      actionType: 'ranged_combat',
      description: 'Shooting or throwing at a target: revolver, shotgun, rifle, thrown stone.',
      associatedSkill: 'firearms',
      associatedCharacteristic: null,
    },
    {
      actionType: 'physical_feat',
      description: 'Climbing, jumping, running, swimming, or forcing a door by strength.',
      associatedSkill: 'athletics',
      associatedCharacteristic: null,
    },
    {
      actionType: 'sneaking',
      description: 'Moving unseen or unheard, hiding, shadowing someone, or lifting something.',
      associatedSkill: 'stealth',
      associatedCharacteristic: null,
    },
    {
      actionType: 'perception',
      description:
        'Noticing, searching, spotting a detail, a hidden door or a lie, reading a scene.',
      associatedSkill: 'observation',
      associatedCharacteristic: null,
    },
    {
      actionType: 'knowledge',
      description:
        'Recalling or working out what ordinary learning teaches: history, languages, science, medicine, a library search.',
      associatedSkill: 'scholarship',
      associatedCharacteristic: null,
    },
    {
      actionType: 'occult_lore',
      description:
        'Reading a forbidden text, recognising a sigil or a rite, performing a ritual or an alchemical operation.',
      associatedSkill: 'occultism',
      associatedCharacteristic: null,
    },
    {
      actionType: 'resisting_horror',
      description:
        'Keeping nerve and mind before the unnatural: resisting terror, a compulsion, a vision or a wrongness of the world.',
      associatedSkill: 'composure',
      associatedCharacteristic: null,
    },
    {
      actionType: 'survival_craft',
      description:
        'Finding a way through wild land or open sea, reading weather and tides, handling a boat, living off a hostile place.',
      associatedSkill: 'survival',
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
      actionType: 'first_aid',
      description:
        'Tending a wound: bandaging, stopping a bleeding, reviving someone knocked out, keeping the dying alive.',
      associatedSkill: 'first_aid',
      associatedCharacteristic: null,
    },
  ],
  /**
   * The generic archetypes the player runs into anywhere, then the creatures
   * and worshippers of the Mythos any scenario may meet. A creature fights
   * with its own claws: no weapon item, its skills and hit points carry the
   * threat.
   */
  npcs: [
    {
      reference: 'townsfolk',
      labels: { en: 'Local', fr: 'Habitant' },
      description: 'Anyone of the common people: a farmer, a shopkeeper, a fisherman, a child.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: {
        skills: { athletics: 30, observation: 30 },
        hitPointsMax: 10,
        weapon: null,
        damageModifier: null,
        armor: 0,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'sailor',
      labels: { en: 'Sailor', fr: 'Marin' },
      description: "A seaman, a deckhand, a stoker or a ship's officer.",
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: {
        skills: { brawling: 45, athletics: 45, survival: 45 },
        hitPointsMax: 12,
        weapon: 'knife',
        damageModifier: null,
        armor: 0,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'professional',
      labels: { en: 'Professional', fr: 'Notable' },
      description: 'A doctor, a lawyer, a professor, a clergyman, a clerk or a journalist.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: {
        skills: { scholarship: 60, persuasion: 45 },
        hitPointsMax: 10,
        weapon: null,
        damageModifier: null,
        armor: 0,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'lawman',
      labels: { en: 'Lawman', fr: 'Homme de loi' },
      description: 'A policeman, a county sheriff or his deputy, a harbour constable.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: {
        skills: { firearms: 45, brawling: 45, intimidation: 45 },
        hitPointsMax: 12,
        weapon: 'revolver',
        damageModifier: null,
        armor: 0,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'thug',
      labels: { en: 'Thug', fr: 'Voyou' },
      description: 'A bootlegger, a dockside tough or a hired gun who lives outside the law.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'unfriendly',
      combat: {
        skills: { brawling: 60, intimidation: 45, stealth: 30 },
        hitPointsMax: 12,
        weapon: 'knife',
        damageModifier: null,
        armor: 0,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'cultist',
      labels: { en: 'Cultist', fr: 'Cultiste' },
      description:
        'A worshipper of the Old Ones or the Outer Gods, ordinary by day, fanatical by night.',
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'hostile',
      combat: {
        skills: { brawling: 45, occultism: 45, deception: 45, stealth: 45 },
        hitPointsMax: 11,
        weapon: 'knife',
        damageModifier: null,
        armor: 0,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'deep_one',
      labels: { en: 'Deep One', fr: 'Profond' },
      description:
        'A creature of the sea, man-shaped and fish-like: grey-green scales, webbed claws, gills, bulging eyes that never close, and a croaking voice. Ageless, and devoted to Dagon and Cthulhu.',
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'hostile',
      combat: {
        skills: { brawling: 75, athletics: 75, stealth: 60, intimidation: 75 },
        hitPointsMax: 16,
        weapon: null,
        damageModifier: '+1D4',
        armor: 2,
      },
      initialLocation: null,
      schedule: [],
    },
    {
      reference: 'deep_one_hybrid',
      labels: { en: 'Hybrid', fr: 'Hybride' },
      description:
        'A human with the blood of the deep: narrow head, unblinking eyes, rough scaly skin at the neck, a shuffling gait. Changing, year by year, into a Deep One.',
      kind: 'archetype',
      generic: false,
      defaultDisposition: 'unfriendly',
      combat: {
        skills: { brawling: 60, athletics: 60, deception: 45, stealth: 45 },
        hitPointsMax: 13,
        weapon: null,
        damageModifier: null,
        armor: 1,
      },
      initialLocation: null,
      schedule: [],
    },
  ],
  /** Archetypes only: each scenario sets its own named places. */
  locations: [
    {
      reference: 'town',
      labels: { en: 'Town', fr: 'Bourg' },
      description: 'A town or village: a main street, a general store, a church, a few houses.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'road',
      labels: { en: 'Road', fr: 'Route' },
      description: 'A road, a dirt track or a path between two places.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'wilderness',
      labels: { en: 'Wilderness', fr: 'Terres sauvages' },
      description: 'Untamed land: woods, hills, marsh, scrub or barren rock.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'shore',
      labels: { en: 'Shore', fr: 'Rivage' },
      description: 'A beach, a cove, a stretch of rocky coast or a reef.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'ship',
      labels: { en: 'Ship', fr: 'Navire' },
      description: 'A ship or a boat, its decks and its holds.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'house',
      labels: { en: 'House', fr: 'Maison' },
      description: "A private house, from a fisherman's shack to a mansion.",
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'church',
      labels: { en: 'Church', fr: 'Église' },
      description: 'A church, a chapel, a meeting house or a graveyard.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'cave',
      labels: { en: 'Cave', fr: 'Caverne' },
      description: 'A cave, a tunnel, a well or any passage under the earth.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
    {
      reference: 'ruin',
      labels: { en: 'Ruin', fr: 'Ruine' },
      description: 'A ruined building or ancient stonework, crumbling and overgrown.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
      periodNotes: [],
    },
  ],
  /**
   * The arms and gear of the 1920s, then generic archetypes for anything else
   * the player picks up. Modifiers in percent, weapons with the dice of BRP —
   * a shotgun at its middle range, 2D6, until range bands exist.
   */
  items: [
    {
      reference: 'leather_jacket',
      labels: { en: 'Leather jacket', fr: 'Blouson de cuir' },
      description: 'A heavy leather jacket, the kind aviators and motorcyclists wear.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: null,
      armor: 1,
      initialHolder: null,
    },
    {
      reference: 'revolver',
      labels: { en: 'Revolver', fr: 'Revolver' },
      description: 'A six-shot revolver, a .38 or a .45.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        kind: 'projectile',
        damage: '1D8',
        damageModifier: 'none',
        special: 'impaling',
      },
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'shotgun',
      labels: { en: 'Shotgun', fr: 'Fusil de chasse' },
      description: 'A double-barrelled shotgun, two shots before reloading.',
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
          description: 'A long gun is hard to hide',
        },
      ],
      weapon: {
        kind: 'projectile',
        damage: '2D6',
        damageModifier: 'none',
        special: null,
      },
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'rifle',
      labels: { en: 'Rifle', fr: 'Carabine' },
      description: 'A bolt-action or lever-action rifle, accurate at long range.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [
        {
          target: 'skill',
          skill: 'firearms',
          value: 10,
          condition: 'equipped',
          description: 'A steady, aimed long gun',
        },
      ],
      weapon: {
        kind: 'projectile',
        damage: '2D6+4',
        damageModifier: 'none',
        special: 'impaling',
      },
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'knife',
      labels: { en: 'Knife', fr: 'Couteau' },
      description: 'A clasp knife, a rigging knife, a hunting knife or a straight razor.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        kind: 'thrown',
        damage: '1D3+1',
        damageModifier: 'full',
        special: 'impaling',
      },
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'improvised_weapon',
      labels: { en: 'Improvised weapon', fr: 'Arme improvisée' },
      description: 'Anything picked up to hit with: a boathook, a crowbar, a poker, an oar.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: true,
      modifiers: [],
      weapon: {
        kind: 'melee',
        damage: '1D6',
        damageModifier: 'full',
        special: 'crushing',
      },
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'rope',
      labels: { en: 'Rope', fr: 'Corde' },
      description: 'A coil of rope or line.',
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
          description: 'A rope to climb or haul with',
        },
      ],
      weapon: null,
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'tool',
      labels: { en: 'Tool', fr: 'Outil' },
      description: 'A key, a lantern, an electric torch, a crowbar or any other implement.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'document',
      labels: { en: 'Document', fr: 'Document' },
      description: 'A letter, a newspaper, a map, a book or any paper of no occult weight.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'trinket',
      labels: { en: 'Trinket', fr: 'Babiole' },
      description: 'A small object of value or interest: a ring, a coin, a carved figurine.',
      kind: 'archetype',
      generic: true,
      stackable: false,
      equippable: false,
      modifiers: [],
      weapon: null,
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'food',
      labels: { en: 'Food', fr: 'Vivres' },
      description: 'A ration of food or a bottle of something to drink.',
      kind: 'archetype',
      generic: true,
      stackable: true,
      equippable: false,
      modifiers: [],
      weapon: null,
      armor: 0,
      initialHolder: null,
    },
    {
      reference: 'ammunition',
      labels: { en: 'Ammunition', fr: 'Munitions' },
      description: 'Cartridges or shells for a firearm, one shot each.',
      kind: 'archetype',
      generic: true,
      stackable: true,
      equippable: false,
      modifiers: [],
      weapon: null,
      armor: 0,
      initialHolder: null,
    },
  ],
  /**
   * The trades of the 1920s an investigator comes from. Each trains a
   * handful of the world's skills and starts every game with the tools of
   * the trade.
   */
  professions: [
    {
      reference: 'antiquarian',
      labels: { en: 'Antiquarian', fr: 'Antiquaire' },
      description:
        'A dealer in old books and curiosities, at home in auction rooms, archives and dusty attics.',
      skills: ['scholarship', 'occultism', 'observation', 'persuasion', 'deception', 'composure'],
      startingItems: [
        { definition: 'tool', descriptor: "a jeweller's loupe", quantity: 1, equipped: false },
      ],
      startingResources: { money: 60 },
    },
    {
      reference: 'physician',
      labels: { en: 'Physician', fr: 'Médecin' },
      description:
        'A doctor of medicine, trained to keep a steady hand and a cool head before blood and death.',
      skills: ['first_aid', 'scholarship', 'observation', 'persuasion', 'composure', 'dodge'],
      startingItems: [
        {
          definition: 'tool',
          descriptor: "a doctor's black bag, with bandages, a stethoscope and morphine",
          quantity: 1,
          equipped: false,
        },
      ],
      startingResources: { money: 80 },
    },
    {
      reference: 'journalist',
      labels: { en: 'Journalist', fr: 'Journaliste' },
      description:
        'A newspaper reporter who chases a story wherever it leads, and gets people to talk.',
      skills: ['observation', 'persuasion', 'deception', 'stealth', 'scholarship', 'athletics'],
      startingItems: [
        {
          definition: 'document',
          descriptor: "a reporter's notebook and a press card",
          quantity: 1,
          equipped: false,
        },
      ],
      startingResources: { money: 30 },
    },
    {
      reference: 'private_investigator',
      labels: { en: 'Private investigator', fr: 'Détective privé' },
      description: 'A licensed private detective: tails, stake-outs and a gun in the coat pocket.',
      skills: [
        'firearms',
        'observation',
        'stealth',
        'intimidation',
        'deception',
        'brawling',
        'dodge',
      ],
      startingItems: [
        { definition: 'revolver', descriptor: null, quantity: 1, equipped: true },
        { definition: 'ammunition', descriptor: null, quantity: 12, equipped: false },
      ],
      startingResources: { money: 40 },
    },
    {
      reference: 'professor',
      labels: { en: 'Professor', fr: 'Professeur' },
      description:
        'A university scholar of languages, history or the sciences, more used to libraries than to danger.',
      skills: [
        'scholarship',
        'occultism',
        'persuasion',
        'composure',
        'observation',
        'intimidation',
      ],
      startingItems: [
        {
          definition: 'document',
          descriptor: 'a sheaf of lecture notes and a university letter of introduction',
          quantity: 1,
          equipped: false,
        },
      ],
      startingResources: { money: 50 },
    },
  ],
  scenarios: [
    {
      reference: 'the_ward_inheritance',
      labels: { en: 'The Ward Inheritance', fr: "L'Héritage de la Famille Ward" },
      synopsis:
        'New England, 1927. A letter from an Arkham attorney informs you that you are the last of the Wards, and heir to Ward House, a shuttered mansion on a lonely hill above the village of Cold Spring, left to you by a great-uncle, Silas Ward, who vanished last winter. Beneath its cellars lies a laboratory where generations of Wards practised a forbidden alchemy, raising the dead from their essential salts — and where Silas began the rite that calls Azathoth, the blind idiot god at the centre of all things. The rite is not finished. Each night, the house comes a little further loose from the world.',
      status: 'published',
      /** The chapters follow the house coming loose from the world. */
      chapters: [
        { reference: 'the_inheritance', labels: { en: 'The Inheritance', fr: "L'Héritage" } },
        {
          reference: 'beneath_the_house',
          labels: { en: 'Beneath the House', fr: 'Sous la maison' },
        },
        { reference: 'the_unravelling', labels: { en: 'The Unravelling', fr: 'Le Délitement' } },
        {
          reference: 'the_calling',
          labels: { en: 'The Calling of Azathoth', fr: "L'Appel d'Azathoth" },
        },
      ],
      quests: [
        {
          reference: 'take_possession',
          labels: { en: 'Take possession of Ward House', fr: 'Prendre possession du manoir Ward' },
        },
        {
          reference: 'the_fate_of_silas',
          labels: { en: 'The fate of Silas Ward', fr: 'Le sort de Silas Ward' },
        },
        { reference: 'stop_the_rite', labels: { en: 'Stop the rite', fr: 'Arrêter le rituel' } },
      ],
      /** What the heir brings from Boston, whatever their trade: the attorney's letter, the keys he sent, a torch. */
      startingKit: {
        items: [
          {
            definition: 'document',
            descriptor: "Mr Crane's letter announcing the inheritance",
            quantity: 1,
            equipped: false,
          },
          {
            definition: 'tool',
            descriptor: 'the iron ring of house keys Mr Crane sent',
            quantity: 1,
            equipped: false,
          },
          { definition: 'tool', descriptor: 'an electric torch', quantity: 1, equipped: false },
        ],
        resources: {},
      },
      /** The story opens as the heir lets himself into the house. */
      initialState: {
        location: 'ward_house_entrance_hall',
        chapter: 'the_inheritance',
        quests: [
          {
            reference: 'take_possession',
            step: 1,
            summary: 'Settle into Ward House and take stock of what your great-uncle left behind.',
          },
          {
            reference: 'the_fate_of_silas',
            step: 1,
            summary:
              'Find out what became of your great-uncle Silas Ward, who vanished last winter.',
          },
        ],
        /** The great-uncle who left the house, and the attorney whose letter announced it. */
        knownNpcs: ['silas_ward', 'ephraim_crane'],
      },
      flags: [],
      events: [],
      /** An autumn afternoon: night falls on the house a few turns in. */
      startTime: '16:00',
      startDate: '1927-10-28',
      glossary: [],
      /**
       * The living who help or hinder the heir, the dead the Wards raised or
       * would raise, and what seeps in through the rite.
       */
      lore: [],
      npcs: [
        {
          reference: 'ephraim_crane',
          labels: { en: 'Mr Crane', fr: 'Maître Crane' },
          description:
            "The Ward family's elderly attorney in Arkham: dry, punctilious, and knowing more about the Wards than he will say.",
          kind: 'unique',
          generic: false,
          defaultDisposition: 'neutral',
          combat: {
            skills: { persuasion: 60, scholarship: 60, observation: 60, deception: 45 },
            hitPointsMax: 10,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: null,
          schedule: [],
        },
        {
          reference: 'martha_pike',
          labels: { en: 'Martha Pike', fr: 'Martha Pike' },
          description:
            'The elderly housekeeper from Cold Spring who kept Ward House: kindly, frightened, she will not go below the ground floor and leaves before dusk.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'friendly',
          combat: {
            skills: { observation: 60, stealth: 45, composure: 45 },
            hitPointsMax: 10,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: 'ward_house_kitchen',
          schedule: [],
        },
        {
          reference: 'henry_armitage',
          labels: { en: 'Dr Armitage', fr: 'Le docteur Armitage' },
          description:
            'Dr Henry Armitage, the elderly librarian of Miskatonic University, learned in forbidden books and afraid of what they hold.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'neutral',
          combat: {
            skills: { scholarship: 90, occultism: 75, composure: 60 },
            hitPointsMax: 10,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: null,
          schedule: [],
        },
        {
          reference: 'nathaniel_crowe',
          labels: { en: 'Nathaniel Crowe', fr: 'Nathaniel Crowe' },
          description:
            'A soft-spoken Boston antiquarian who wants the Ward papers at any price — in truth a priest of the Outer Gods, waiting for the rite to be finished.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'neutral',
          combat: {
            skills: { occultism: 75, deception: 75, persuasion: 60, firearms: 45 },
            hitPointsMax: 12,
            weapon: 'revolver',
            damageModifier: null,
            armor: 0,
          },
          initialLocation: null,
          schedule: [],
        },
        {
          reference: 'josiah_ward',
          labels: { en: 'Josiah Ward', fr: 'Josiah Ward' },
          description:
            'The alchemist of the family, dead since 1771, whose essential salts wait in the laboratory; once raised, a courtly, archaic gentleman who wants the rite completed.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'neutral',
          combat: {
            skills: { occultism: 90, deception: 75, scholarship: 75, intimidation: 60 },
            hitPointsMax: 12,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: null,
          schedule: [],
        },
        {
          reference: 'silas_ward',
          labels: { en: 'Silas Ward', fr: 'Silas Ward' },
          description:
            "The heir's great-uncle, vanished last winter — in truth alive in the sealed vault, wasted and half unmade by what his rite let in.",
          kind: 'unique',
          generic: false,
          defaultDisposition: 'unfriendly',
          combat: {
            skills: { occultism: 75, stealth: 60, brawling: 45 },
            hitPointsMax: 11,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: 'sealed_vault',
          schedule: [],
        },
        {
          reference: 'imperfect_revenant',
          labels: { en: 'Revenant', fr: 'Revenant' },
          description:
            'A creature raised from impure or incomplete salts: malformed, mewling and in pain, kept in the pits beneath the laboratory.',
          kind: 'archetype',
          generic: false,
          defaultDisposition: 'hostile',
          combat: {
            skills: { brawling: 60, athletics: 45 },
            hitPointsMax: 12,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: null,
          schedule: [],
        },
        {
          reference: 'piping_servitor',
          labels: { en: 'Piping servitor', fr: 'Serviteur flûtiste' },
          description:
            'A shapeless, flute-piping thing of the court of Azathoth that seeps through wherever the rite has thinned the world; to look at it is to lose the thread of things.',
          kind: 'archetype',
          generic: false,
          defaultDisposition: 'hostile',
          combat: {
            skills: { brawling: 75, stealth: 60, intimidation: 90 },
            hitPointsMax: 18,
            weapon: null,
            damageModifier: null,
            armor: 0,
          },
          initialLocation: null,
          schedule: [],
        },
      ],
      /**
       * The towns nearby, then the house room by room: an investigation is
       * played at the grain of a room, so going from the library to the
       * study is a movement, and what lies in each room stays there. The
       * house itself only contains them: its rooms are a network, gone
       * through by their exits, entered from the free places by the drive
       * (the grounds) or the back door (the kitchen). The laboratory lies
       * behind a door hidden in the cellar; the vault behind an iron door
       * the iron key opens; the pits under the laboratory floor.
       */
      locations: [
        {
          reference: 'new_england',
          labels: { en: 'New England', fr: 'Nouvelle-Angleterre' },
          description:
            'Rural Massachusetts: old stone walls, abandoned farms, dark woods and hills that keep their secrets.',
          kind: 'unique',
          parent: null,
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'arkham',
          labels: { en: 'Arkham', fr: 'Arkham' },
          description:
            'An old college town on the Miskatonic river, home of the university and its library of rare and forbidden books.',
          kind: 'unique',
          parent: 'new_england',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'cold_spring',
          labels: { en: 'Cold Spring', fr: 'Cold Spring' },
          description:
            'A dwindling village at the foot of Ward hill: a general store, a white church, and villagers who avoid speaking of the Wards.',
          kind: 'unique',
          parent: 'new_england',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house',
          labels: { en: 'Ward House', fr: 'Le manoir Ward' },
          description:
            'The Ward estate on its lonely hill: a gambrel-roofed Georgian mansion shuttered for a year, its grounds, outbuildings and family plot.',
          kind: 'unique',
          parent: 'new_england',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_grounds',
          labels: { en: 'The grounds', fr: 'Le parc' },
          description:
            'The overgrown grounds around the house: a weed-choked drive, a dry fountain, dead hedges, and old elms leaning toward the windows.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_house_entrance_hall',
              passage: 'the front door under its fanlight, up three worn steps',
              backPassage: 'the front door, out onto the drive',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_carriage_house',
              passage: 'the wide double doors of an outbuilding, by the drive',
              backPassage: 'the wide doors, out onto the drive',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_family_cemetery',
              passage: 'a path running round the side of the house',
              backPassage: 'the path back round the house',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: true,
          periodNotes: [],
        },
        {
          reference: 'ward_house_carriage_house',
          labels: { en: 'The carriage house', fr: 'La remise' },
          description:
            "The old carriage house by the drive, where Silas's black Packard still stands under a tarpaulin, its tank full: he never drove away.",
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_family_cemetery',
          labels: { en: 'The Ward family plot', fr: 'Le cimetière des Ward' },
          description:
            'The family burial ground behind the house, under old elms; some of its graves have been opened, and not from above.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_entrance_hall',
          labels: { en: 'The entrance hall', fr: "Le hall d'entrée" },
          description:
            'A tall panelled hall with a staircase rising into shadow, a long-case clock stopped at seventeen minutes past three, and family portraits — one of them turned to the wall.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_house_parlour',
              passage: 'tall double doors on the left of the hall',
              backPassage: 'the tall double doors',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_dining_room',
              passage: 'a door on the right of the hall',
              backPassage: 'the main door of the room',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_library',
              passage: 'a heavy door beside the stairs',
              backPassage: 'the heavy door',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_upstairs_corridor',
              passage: 'the staircase rising into shadow',
              backPassage: 'the main staircase, going down',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_kitchen',
              passage:
                'a passage behind the stairs, toward the back of the house, smelling of old cooking',
              backPassage: 'a passage toward the front of the house',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_parlour',
          labels: { en: 'The parlour', fr: 'Le salon' },
          description:
            'The formal front parlour: furniture under dust sheets, a piano gone out of tune, curtains drawn for a year.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_dining_room',
          labels: { en: 'The dining room', fr: 'La salle à manger' },
          description:
            'A long dining room with the table still laid for two, as if for a guest, its dishes furred with dust.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_house_kitchen',
              passage: 'a swing door in the corner, for the servants',
              backPassage: 'a swing door, for serving',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_library',
          labels: { en: 'The library', fr: 'La bibliothèque' },
          description:
            'Floor-to-ceiling shelves of old books, family papers and county histories, a reading table, and gaps on the shelves where volumes were taken down.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_house_study',
              passage: 'a narrow door at the back of the room',
              backPassage: 'the narrow door',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_study',
          labels: { en: "Silas's study", fr: 'Le bureau de Silas' },
          description:
            "Silas Ward's study: a cluttered desk, star charts pinned to the panelling, ash in the grate, and a drawer that locks.",
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_kitchen',
          labels: { en: 'The kitchen', fr: 'La cuisine' },
          description:
            "The kitchen at the back of the house, the housekeeper's domain: a range, a pantry, the servants' stair, and a door that sticks.",
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_family_cemetery',
              passage: 'the back door, out behind the house',
              backPassage: 'a back door into the house',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_upstairs_corridor',
              passage: "the servants' stair, narrow and steep",
              backPassage: "the narrow servants' stair, going down",
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_cellar',
              passage: 'a door that sticks, onto steep wooden stairs going down',
              backPassage: 'the steep wooden stairs, going up',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: true,
          periodNotes: [],
        },
        {
          reference: 'ward_house_upstairs_corridor',
          labels: { en: 'The upstairs corridor', fr: "Le couloir de l'étage" },
          description:
            'The first-floor corridor that serves the bedrooms, lined with closed doors; on some nights it runs longer than the house.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_house_silas_bedroom',
              passage: 'a door at the end of the corridor',
              backPassage: 'the door out of the room',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_guest_bedroom',
              passage: 'a door halfway along the corridor',
              backPassage: 'the door out of the room',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_attic',
              passage: 'a hatch in the ceiling and a folding ladder',
              backPassage: 'the hatch in the floor, and the ladder down',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_silas_bedroom',
          labels: { en: "Silas's bedroom", fr: 'La chambre de Silas' },
          description:
            "Silas Ward's bedroom, left as he left it: an unmade bed, clothes in the wardrobe, a pocket watch stopped on the nightstand.",
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_guest_bedroom',
          labels: { en: 'The guest bedroom', fr: "La chambre d'amis" },
          description:
            'The bedroom the housekeeper made ready for the heir, aired and clean, its window on the graves behind the house.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_attic',
          labels: { en: 'The attic', fr: 'Le grenier' },
          description:
            'The attic under the gambrel roof: trunks and crates of two centuries of Wards, an eighteenth-century portrait under a sheet, and a round window on the hill.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_house_cellar',
          labels: { en: 'The cellar', fr: 'La cave' },
          description:
            'A cellar under the house: wine racks, a coal bin, rotting barrels, and a cold draught that seems to come from behind the racks.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_laboratory',
              passage: 'behind the wine racks, a narrow door on stairs going further down',
              backPassage: 'the narrow stairs up to a door hidden behind racks of bottles',
              hidden: true,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_laboratory',
          labels: { en: 'The laboratory', fr: 'Le laboratoire' },
          description:
            'A vaulted laboratory dug deep beneath the house: furnaces, alembics, shelves of jars of grey salts, iron lids set in the floor. Here the world is thin — corners do not meet, and the walls seem to breathe.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_laboratory_pits',
              passage: 'an iron lid in the floor, and a rusted ladder down into the dark',
              backPassage: 'the rusted ladder, up toward the light',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'sealed_vault',
              passage: 'an iron door at the back of the room',
              backPassage: 'the iron door',
              hidden: false,
              requires: 'iron_vault_key',
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'ward_laboratory_pits',
          labels: { en: 'The pits', fr: 'Les fosses' },
          description:
            'Brick-lined pits beneath the iron lids of the laboratory floor, where the Wards kept what they raised imperfectly. Something down there still moves.',
          kind: 'unique',
          parent: 'ward_laboratory',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
        {
          reference: 'sealed_vault',
          labels: { en: 'The sealed vault', fr: 'Le caveau scellé' },
          description:
            'A deeper chamber behind an iron door, where Silas drew the circle of the rite of Azathoth. A far, thin piping never stops, and the dark beyond the circle has no walls.',
          kind: 'unique',
          parent: 'ward_laboratory',
          exits: [],
          entrance: false,
          periodNotes: [],
        },
      ],
      /**
       * The books and keys of the mystery, the salts of the alchemy, and the
       * instruments of the rite and of its undoing.
       */
      items: [
        {
          reference: 'silas_journal',
          labels: { en: "Silas Ward's journal", fr: 'Le journal de Silas Ward' },
          description:
            "Silas Ward's journal, hidden in his study, recording his experiments with the salts, the rite he began, and his growing terror.",
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [
            {
              target: 'skill',
              skill: 'occultism',
              value: 10,
              condition: 'owned',
              description: "Silas's notes on the salts and on the rite",
            },
          ],
          weapon: null,
          armor: 0,
          initialHolder: { holder: 'location', reference: 'ward_house_study' },
        },
        {
          reference: 'iron_vault_key',
          labels: { en: 'The iron key', fr: 'La clé de fer' },
          description:
            "A heavy iron key, hidden in the hollow bedpost of Silas's bed, that opens the iron door at the back of the laboratory.",
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [],
          weapon: null,
          armor: 0,
          initialHolder: { holder: 'location', reference: 'ward_house_silas_bedroom' },
        },
        {
          reference: 'necronomicon',
          labels: { en: 'The Necronomicon', fr: 'Le Necronomicon' },
          description:
            "John Dee's English translation of the Necronomicon of Abdul Alhazred, its margins crowded with Josiah Ward's notes on the salts and on the rite of Azathoth.",
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [
            {
              target: 'skill',
              skill: 'occultism',
              value: 20,
              condition: 'owned',
              description: 'The rites and formulae it holds',
            },
            {
              target: 'skill',
              skill: 'composure',
              value: -10,
              condition: 'owned',
              description: "Reading it erodes the reader's hold on the world",
            },
          ],
          weapon: null,
          armor: 0,
          initialHolder: { holder: 'location', reference: 'ward_laboratory' },
        },
        {
          reference: 'josiah_salts',
          labels: { en: 'The salts of Josiah Ward', fr: 'Les sels de Josiah Ward' },
          description:
            'A lead urn of fine grey-blue powder: the essential salts of Josiah Ward, which the ascending formula raises into the living man.',
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [],
          weapon: null,
          armor: 0,
          initialHolder: { holder: 'location', reference: 'ward_laboratory' },
        },
        {
          reference: 'obsidian_athame',
          labels: { en: 'The obsidian knife', fr: "Le couteau d'obsidienne" },
          description:
            'A black glass knife engraved with the seal of Azathoth, the instrument that opens and closes the circle of the rite.',
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: true,
          modifiers: [
            {
              target: 'skill',
              skill: 'occultism',
              value: 10,
              condition: 'equipped',
              description: "The rite's own instrument, in hand",
            },
          ],
          /** A dagger of the book, keener than it looks. */
          weapon: {
            kind: 'melee',
            damage: '1D4+2',
            damageModifier: 'full',
            special: 'impaling',
          },
          armor: 0,
          initialHolder: { holder: 'location', reference: 'sealed_vault' },
        },
        {
          reference: 'descending_formula',
          labels: { en: 'The descending formula', fr: 'La formule descendante' },
          description:
            "A slip of paper in Armitage's hand bearing the descending formula — the words that return what the salts raised to dust.",
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [
            {
              target: 'skill',
              skill: 'occultism',
              value: 10,
              condition: 'owned',
              description: 'The words that unmake what alchemy raised',
            },
          ],
          weapon: null,
          armor: 0,
          initialHolder: { holder: 'npc', reference: 'henry_armitage' },
        },
        {
          reference: 'jar_of_salts',
          labels: { en: 'Jar of salts', fr: 'Bocal de sels' },
          description:
            'A stoppered jar of grey essential salts, labelled in an old hand with a name and a date: someone, waiting to be raised.',
          kind: 'archetype',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [],
          weapon: null,
          armor: 0,
          initialHolder: null,
        },
        {
          reference: 'alchemical_reagent',
          labels: { en: 'Alchemical reagent', fr: 'Réactif alchimique' },
          description:
            'A dose of an alchemical preparation: quicksilver, vitriol, sulphur, powdered bone.',
          kind: 'archetype',
          generic: true,
          stackable: true,
          equippable: false,
          modifiers: [],
          weapon: null,
          armor: 0,
          initialHolder: null,
        },
      ],
    },
  ],
}
