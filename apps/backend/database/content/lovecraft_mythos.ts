import type { WorldContent } from '#services/game/content/types'

/**
 * H. P. Lovecraft's Mythos, as the content seeder writes it to the database.
 *
 * Like the first world, it leans on fiction the model already knows: no lore
 * corpus of its own. Lovecraft died in 1937, and his work has been in the
 * public domain in Europe since 2008.
 *
 * The world carries what both scenarios share — the 1920s, the rules of
 * cosmic horror, the skills, the generic archetypes and the creatures of the
 * Mythos. Each scenario brings its own cast, places and items. Tone, rules and
 * ambiance are all the model reads of the world, so they cover the sea and
 * New England alike.
 *
 * Everything is in English except the French labels: only the narration is
 * ever produced in the player's language.
 */
export const LOVECRAFT_MYTHOS_CONTENT: WorldContent = {
  reference: 'lovecraft_mythos',
  labels: { en: 'The Lovecraft Mythos', fr: 'Le Mythe de Lovecraft' },
  narrativeTone:
    '1920s cosmic horror: slow-building dread, knowledge that costs, and a universe vast, ancient and indifferent to mankind.',
  rules: [
    'The supernatural is real but rare, alien and never benevolent. It answers to no hero and offers no wonder without a price.',
    'There is no magic at the call of the characters: a rite or a formula comes from a forbidden text, takes time and preparation, and always costs the one who uses it.',
    'The creatures of the Mythos far outmatch ordinary people. Bullets wound them but rarely stop them; flight, hiding and wits save more lives than fighting.',
    'Facing the unnatural shakes the mind as a blow shakes the body: a dreadful sight or revelation can cost hit points, and nerve fails before it.',
    'Where the Outer Gods are invoked, reality comes apart little by little: distances shift, time slips, rooms and faces are not what they were. The closer a rite comes to completion, the worse it grows.',
    'This is the 1920s: telegraph and wireless, steamships, a few motor cars, revolvers and shotguns. Prohibition is in force in the United States.',
    'The authorities and the learned dismiss tales of the uncanny. Proof is hard to keep, and harder still to make anyone believe.',
    'Travel takes days and help is far away: the isolated stay isolated.',
  ],
  ambiance: [
    'Fog off the sea, old stone furred with lichen, the smell of brine, mildew and something rotten beneath.',
    'Cyclopean masonry: monoliths too vast for human hands, at angles that seem at once convex and concave.',
    'Sounds just below hearing — a far piping, a chant, a wet slither — that stop the moment anyone listens.',
    'Decaying New England: gambrel roofs, shuttered windows, hollow-eyed farmhouses and villagers who say less than they know.',
    'The ocean is vast, cold and older than anything that walks; it keeps what it takes.',
    'Near a place where the Outer Gods have been called, the world wears thin: clocks disagree, a corridor runs longer than the house, a familiar face is wrong for an instant.',
  ],
  /**
   * Flat and short, as in the first world, with the base chances of BRP.
   * `composure` stands where a sanity score would: the nerve to face the
   * unnatural is rolled, and what it costs comes off hit points — until BRP's
   * own sanity rules arrive with the optional rules (Phase 10bis).
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
  ],
  /**
   * The generic archetypes the player runs into anywhere, then the creatures
   * and worshippers of the Mythos both scenarios may meet. A creature fights
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
      combat: { skills: { athletics: 30, observation: 30 }, hitPointsMax: 10, weapon: null },
      initialLocation: null,
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
      },
      initialLocation: null,
    },
    {
      reference: 'professional',
      labels: { en: 'Professional', fr: 'Notable' },
      description: 'A doctor, a lawyer, a professor, a clergyman, a clerk or a journalist.',
      kind: 'archetype',
      generic: true,
      defaultDisposition: 'neutral',
      combat: { skills: { scholarship: 60, persuasion: 45 }, hitPointsMax: 10, weapon: null },
      initialLocation: null,
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
      },
      initialLocation: null,
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
      },
      initialLocation: null,
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
      },
      initialLocation: null,
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
      },
      initialLocation: null,
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
      },
      initialLocation: null,
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
    },
    {
      reference: 'road',
      labels: { en: 'Road', fr: 'Route' },
      description: 'A road, a dirt track or a path between two places.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'wilderness',
      labels: { en: 'Wilderness', fr: 'Terres sauvages' },
      description: 'Untamed land: woods, hills, marsh, scrub or barren rock.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'shore',
      labels: { en: 'Shore', fr: 'Rivage' },
      description: 'A beach, a cove, a stretch of rocky coast or a reef.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'ship',
      labels: { en: 'Ship', fr: 'Navire' },
      description: 'A ship or a boat, its decks and its holds.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'house',
      labels: { en: 'House', fr: 'Maison' },
      description: "A private house, from a fisherman's shack to a mansion.",
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'church',
      labels: { en: 'Church', fr: 'Église' },
      description: 'A church, a chapel, a meeting house or a graveyard.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'cave',
      labels: { en: 'Cave', fr: 'Caverne' },
      description: 'A cave, a tunnel, a well or any passage under the earth.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
    {
      reference: 'ruin',
      labels: { en: 'Ruin', fr: 'Ruine' },
      description: 'A ruined building or ancient stonework, crumbling and overgrown.',
      kind: 'archetype',
      parent: null,
      exits: [],
      entrance: false,
    },
  ],
  /**
   * The arms and gear of the 1920s, then generic archetypes for anything else
   * the player picks up. Modifiers in percent, weapons with the dice of BRP —
   * a shotgun at its middle range, 2D6, until range bands exist.
   */
  items: [
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
        skill: 'firearms',
        damage: '1D8',
        damageModifier: 'none',
        special: 'impaling',
      },
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
        skill: 'firearms',
        damage: '2D6',
        damageModifier: 'none',
        special: null,
      },
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
        skill: 'firearms',
        damage: '2D6+4',
        damageModifier: 'none',
        special: 'impaling',
      },
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
        skill: 'brawling',
        damage: '1D3+1',
        damageModifier: 'full',
        special: 'impaling',
      },
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
        skill: 'brawling',
        damage: '1D6',
        damageModifier: 'full',
        special: 'crushing',
      },
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
      initialHolder: null,
    },
  ],
  scenarios: [
    {
      reference: 'the_wreck_of_the_sovereign',
      labels: { en: 'The Wreck of the Sovereign', fr: "L'Épave du Sovereign" },
      synopsis:
        "1926, the South Pacific. A seaquake has thrown up an island of black basalt where the charts show only open ocean, and on its slopes, crusted with weed and shells, lies the steamer Sovereign — lost with all hands a year ago, lifted from the sea floor with the rock. The trading schooner Perseverance has dropped anchor beyond the reef, and her captain sends a boat ashore for the Sovereign's strongbox. You pull an oar in that boat. Past the wreck, monoliths of carved stone rise from the steam, and the things that built them are not all dead.",
      status: 'published',
      chapters: [
        { reference: 'landfall', labels: { en: 'Landfall', fr: "L'Accostage" } },
        { reference: 'the_monoliths', labels: { en: 'The Monoliths', fr: 'Les Monolithes' } },
        {
          reference: 'what_sleeps_below',
          labels: { en: 'What Sleeps Below', fr: 'Ce qui dort en dessous' },
        },
      ],
      quests: [
        {
          reference: 'salvage_the_strongbox',
          labels: { en: 'Salvage the strongbox', fr: 'Récupérer le coffre-fort' },
        },
        {
          reference: 'the_fate_of_the_sovereign',
          labels: { en: 'The fate of the Sovereign', fr: 'Le sort du Sovereign' },
        },
        {
          reference: 'escape_the_island',
          labels: { en: 'Escape the island', fr: "Quitter l'île" },
        },
      ],
      pregeneratedCharacter: {
        name: 'Jack Callahan',
        /** An able seaman, strong and weathered, more at home on deck than in a library. */
        characteristics: { STR: 15, CON: 15, SIZ: 14, INT: 11, POW: 11, DEX: 13, CHA: 9 },
        skills: {
          athletics: 60,
          survival: 60,
          brawling: 45,
          observation: 30,
          firearms: 30,
          composure: 30,
          intimidation: 30,
        },
        resources: { money: 6 },
        /** What an able seaman takes ashore: his knife, a line, a lantern, a day's food. */
        items: [
          {
            definition: 'knife',
            descriptor: "a sailor's rigging knife, its blade worn thin",
            quantity: 1,
            equipped: true,
          },
          {
            definition: 'rope',
            descriptor: 'a coil of tarred hemp line',
            quantity: 1,
            equipped: false,
          },
          { definition: 'tool', descriptor: 'a storm lantern', quantity: 1, equipped: false },
          {
            definition: 'food',
            descriptor: "ship's biscuit and salt pork",
            quantity: 2,
            equipped: false,
          },
        ],
      },
      /** The story opens as the boat grounds on the island's beach. */
      initialState: {
        location: 'black_sand_beach',
        chapter: 'landfall',
        quests: [
          {
            reference: 'salvage_the_strongbox',
            step: 1,
            summary:
              "Find the Sovereign's strongbox in the wreck and bring it back to the boat for Captain Marsh.",
          },
        ],
      },
      /** At first light, the boat still in the surf. */
      startTime: '07:00',
      startDate: '1926-03-11',
      glossary: [{ reference: 'ponape', labels: { en: 'Ponape', fr: 'Ponape' } }],
      /**
       * The landing party, the captain who sent it, and what waits ashore:
       * the Sovereign's master, changed, and the priest of the drowned temple.
       */
      npcs: [
        {
          reference: 'captain_elias_marsh',
          labels: { en: 'Captain Marsh', fr: 'Capitaine Marsh' },
          description:
            'Master of the Perseverance, a Marsh of Innsmouth: gruff, secretive, and steering for this island on purpose. He stays aboard.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'neutral',
          combat: {
            skills: { firearms: 60, survival: 75, intimidation: 60, deception: 60, occultism: 45 },
            hitPointsMax: 13,
            weapon: 'revolver',
          },
          initialLocation: null,
        },
        {
          reference: 'bosun_mcrae',
          labels: { en: 'Bosun McRae', fr: 'Le bosco McRae' },
          description:
            'Bosun of the Perseverance and leader of the landing party: a hard, practical Scot who believes in nothing he cannot punch.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'friendly',
          combat: {
            skills: { brawling: 75, athletics: 60, survival: 60, intimidation: 60 },
            hitPointsMax: 14,
            weapon: 'knife',
          },
          initialLocation: 'black_sand_beach',
        },
        {
          reference: 'tomas_reyes',
          labels: { en: 'Tomás Reyes', fr: 'Tomás Reyes' },
          description:
            'A young Filipino deckhand of the landing party, quick and superstitious, who knows island tales of the people from the sea.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'friendly',
          combat: {
            skills: { athletics: 60, observation: 60, stealth: 45, survival: 45 },
            hitPointsMax: 11,
            weapon: 'knife',
          },
          initialLocation: 'black_sand_beach',
        },
        {
          reference: 'professor_whitcombe',
          labels: { en: 'Professor Whitcombe', fr: 'Le professeur Whitcombe' },
          description:
            'A Miskatonic University geologist who paid his passage to study the new island and came ashore with the boat: eager, short-sighted, out of his depth.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'neutral',
          combat: {
            skills: { scholarship: 75, occultism: 45, observation: 45 },
            hitPointsMax: 10,
            weapon: null,
          },
          initialLocation: 'black_sand_beach',
        },
        {
          reference: 'captain_voss',
          labels: { en: 'Captain Voss', fr: 'Capitaine Voss' },
          description:
            'Master of the Sovereign, thought drowned a year ago — alive in the wreck, and changed: gills at his throat, eyes that never blink, his mind given to the deep.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'unfriendly',
          combat: {
            skills: { brawling: 75, stealth: 60, deception: 60, occultism: 60 },
            hitPointsMax: 14,
            weapon: null,
          },
          initialLocation: 'sovereign_wreck',
        },
        {
          reference: 'the_drowned_priest',
          labels: { en: 'The Drowned Priest', fr: 'Le Prêtre noyé' },
          description:
            'An ancient Deep One, vast and draped in weed and pale gold, who leads the rites in the drowned temple and calls to what sleeps beneath the island.',
          kind: 'unique',
          generic: false,
          defaultDisposition: 'hostile',
          combat: {
            skills: { brawling: 90, occultism: 90, intimidation: 90, athletics: 60 },
            hitPointsMax: 22,
            weapon: null,
          },
          initialLocation: 'drowned_temple',
        },
      ],
      /** The ocean, the schooner, and the island from its beach to its drowned heart. */
      locations: [
        {
          reference: 'south_pacific',
          labels: { en: 'The South Pacific', fr: 'Le Pacifique Sud' },
          description: 'Thousands of miles of empty ocean, far from any shipping lane.',
          kind: 'unique',
          parent: null,
          exits: [],
          entrance: false,
        },
        {
          reference: 'the_perseverance',
          labels: { en: 'The Perseverance', fr: 'La Perseverance' },
          description:
            'A battered three-masted trading schooner anchored beyond the reef, a long row from the beach.',
          kind: 'unique',
          parent: 'south_pacific',
          exits: [],
          entrance: false,
        },
        {
          reference: 'risen_island',
          labels: { en: 'The risen island', fr: "L'île surgie" },
          description:
            'An island of black basalt and steaming mud, risen from the seabed weeks ago and absent from every chart. Dead fish rot everywhere, and the ground still trembles.',
          kind: 'unique',
          parent: 'south_pacific',
          exits: [],
          entrance: false,
        },
        {
          reference: 'black_sand_beach',
          labels: { en: 'The black sand beach', fr: 'La plage de sable noir' },
          description:
            'A beach of black volcanic sand strewn with dead fish and weed, where the landing party grounds its boat. Odd tracks lead inland.',
          kind: 'unique',
          parent: 'risen_island',
          exits: [],
          entrance: false,
        },
        {
          reference: 'sovereign_wreck',
          labels: { en: 'The wreck of the Sovereign', fr: "L'épave du Sovereign" },
          description:
            'The steamer Sovereign, stranded high on the slope, her hull crusted with shells and weed, her holds still dripping. Her crew is nowhere — or not quite.',
          kind: 'unique',
          parent: 'risen_island',
          exits: [],
          entrance: false,
        },
        {
          reference: 'cyclopean_ruins',
          labels: { en: 'The monoliths', fr: 'Les monolithes' },
          description:
            "Ruins of monolithic stone at the island's heart, blocks too vast for human hands, carved with sea-things and set at angles the eye cannot hold.",
          kind: 'unique',
          parent: 'risen_island',
          exits: [],
          entrance: false,
        },
        {
          reference: 'drowned_temple',
          labels: { en: 'The drowned temple', fr: 'Le temple englouti' },
          description:
            'A temple sunk into the ruins, its lower halls still flooded with black water, where the Deep Ones gather around a great sealed door.',
          kind: 'unique',
          parent: 'cyclopean_ruins',
          exits: [],
          entrance: false,
        },
      ],
      items: [
        {
          reference: 'sovereign_strongbox',
          labels: { en: "The Sovereign's strongbox", fr: 'Le coffre-fort du Sovereign' },
          description:
            "The Sovereign's iron strongbox, holding the company's gold and papers — heavy enough to need both arms.",
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [
            {
              target: 'skill',
              skill: 'athletics',
              value: -10,
              condition: 'owned',
              description: 'Lugging a heavy iron box',
            },
          ],
          weapon: null,
          initialHolder: { holder: 'location', reference: 'sovereign_wreck' },
        },
        {
          reference: 'sovereign_logbook',
          labels: { en: "Captain Voss's logbook", fr: 'Le journal de bord du capitaine Voss' },
          description:
            "The Sovereign's log, swollen with seawater; its last entries record how the ship went down, and the words the drowned crew learned below.",
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
              description: 'The rites and names the drowned crew wrote down',
            },
          ],
          weapon: null,
          initialHolder: { holder: 'location', reference: 'sovereign_wreck' },
        },
        {
          reference: 'elder_sign_stone',
          labels: { en: 'The star-stone', fr: 'La pierre étoilée' },
          description:
            'A grey, five-pointed stone carved with the Elder Sign, which the things of the deep cannot abide.',
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [
            {
              target: 'skill',
              skill: 'composure',
              value: 20,
              condition: 'owned',
              description: 'The Elder Sign steadies the mind against what comes from the deep',
            },
          ],
          weapon: null,
          initialHolder: { holder: 'location', reference: 'cyclopean_ruins' },
        },
        {
          reference: 'deep_one_tiara',
          labels: { en: 'The pale gold tiara', fr: "Le diadème d'or pâle" },
          description:
            'A tall tiara of pale, strange gold worked with sea-creatures in no human style, worn by the priest of the drowned temple.',
          kind: 'unique',
          generic: false,
          stackable: false,
          equippable: false,
          modifiers: [
            {
              target: 'skill',
              skill: 'composure',
              value: -10,
              condition: 'owned',
              description: 'Its alien patterns gnaw at the mind of whoever keeps it',
            },
          ],
          weapon: null,
          initialHolder: { holder: 'npc', reference: 'the_drowned_priest' },
        },
      ],
    },
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
      pregeneratedCharacter: {
        name: 'Edmund Ward',
        /** A Boston scholar, sharp and bookish, unused to hardship. */
        characteristics: { STR: 10, CON: 11, SIZ: 12, INT: 16, POW: 14, DEX: 11, CHA: 12 },
        skills: {
          scholarship: 60,
          observation: 45,
          persuasion: 45,
          occultism: 30,
          composure: 30,
          athletics: 30,
          firearms: 30,
        },
        resources: { money: 40 },
        /** What the heir brings from Boston: the attorney's letter, the keys he sent, a torch. */
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
      },
      /** An autumn afternoon: night falls on the house a few turns in. */
      startTime: '16:00',
      startDate: '1927-10-28',
      glossary: [],
      /**
       * The living who help or hinder the heir, the dead the Wards raised or
       * would raise, and what seeps in through the rite.
       */
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
          },
          initialLocation: null,
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
          },
          initialLocation: 'ward_house_kitchen',
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
          },
          initialLocation: null,
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
          },
          initialLocation: null,
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
          },
          initialLocation: null,
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
          },
          initialLocation: 'sealed_vault',
        },
        {
          reference: 'imperfect_revenant',
          labels: { en: 'Revenant', fr: 'Revenant' },
          description:
            'A creature raised from impure or incomplete salts: malformed, mewling and in pain, kept in the pits beneath the laboratory.',
          kind: 'archetype',
          generic: false,
          defaultDisposition: 'hostile',
          combat: { skills: { brawling: 60, athletics: 45 }, hitPointsMax: 12, weapon: null },
          initialLocation: null,
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
          },
          initialLocation: null,
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
              passage: 'the carriage house doors, by the drive',
              backPassage: 'the carriage house doors, out onto the drive',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_family_cemetery',
              passage: 'a path round the house to the family plot behind it',
              backPassage: 'the path round the house to the drive',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: true,
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
              passage: 'the double doors of the front parlour',
              backPassage: 'the double doors back to the hall',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_dining_room',
              passage: 'the door to the dining room',
              backPassage: 'the door back to the hall',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_library',
              passage: 'the library door, beside the stairs',
              backPassage: 'the door back to the hall',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_upstairs_corridor',
              passage: 'the staircase rising into shadow',
              backPassage: 'the staircase down to the hall',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_kitchen',
              passage: 'a passage behind the stairs, to the kitchen at the back of the house',
              backPassage: 'the passage back to the hall',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
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
              passage: 'a swing door to the kitchen',
              backPassage: 'the swing door to the dining room',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
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
              passage: "a narrow door at the back of the library, into Silas's study",
              backPassage: 'the narrow door back to the library',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
        },
        {
          reference: 'ward_house_study',
          labels: { en: "Silas's study", fr: 'Le bureau de Silas' },
          description:
            "Silas Ward's study off the library: a cluttered desk, star charts pinned to the panelling, ash in the grate, and a drawer that locks.",
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
        },
        {
          reference: 'ward_house_kitchen',
          labels: { en: 'The kitchen', fr: 'La cuisine' },
          description:
            "The kitchen at the back of the house, Martha Pike's domain: a range, a pantry, the servants' stair, and the cellar door that sticks.",
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_family_cemetery',
              passage: 'the back door, onto the path to the family plot',
              backPassage: 'the back door of the kitchen',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_upstairs_corridor',
              passage: "the servants' stair, narrow and steep",
              backPassage: "the servants' stair down to the kitchen",
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_cellar',
              passage: 'the cellar door that sticks, and steep wooden stairs down',
              backPassage: 'the steep stairs up to the kitchen',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: true,
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
              passage: "the door of Silas's bedroom",
              backPassage: 'the door back to the corridor',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_guest_bedroom',
              passage: 'the door of the guest bedroom',
              backPassage: 'the door back to the corridor',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'ward_house_attic',
              passage: 'a hatch in the ceiling and a folding ladder',
              backPassage: 'the hatch down to the corridor',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
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
        },
        {
          reference: 'ward_house_guest_bedroom',
          labels: { en: 'The guest bedroom', fr: "La chambre d'amis" },
          description:
            'The bedroom Martha Pike made ready for the heir, aired and clean, its window on the family plot.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [],
          entrance: false,
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
        },
        {
          reference: 'ward_house_cellar',
          labels: { en: 'The cellar', fr: 'La cave' },
          description:
            'The cellar under the kitchen: wine racks, a coal bin, rotting barrels, and a cold draught that seems to come from behind the racks.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_laboratory',
              passage: 'behind the wine racks, a narrow door on stairs going further down',
              backPassage: "the narrow stairs up to a door behind the cellar's wine racks",
              hidden: true,
              requires: null,
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
        },
        {
          reference: 'ward_laboratory',
          labels: { en: 'The laboratory', fr: 'Le laboratoire' },
          description:
            'A vaulted laboratory dug beneath the cellar: furnaces, alembics, shelves of jars of grey salts, iron lids set in the floor. Here the world is thin — corners do not meet, and the walls seem to breathe.',
          kind: 'unique',
          parent: 'ward_house',
          exits: [
            {
              to: 'ward_laboratory_pits',
              passage: 'an iron lid in the floor, and a rusted ladder down into the dark',
              backPassage: 'the rusted ladder up to the laboratory',
              hidden: false,
              requires: null,
              oneWay: false,
              duration: null,
            },
            {
              to: 'sealed_vault',
              passage: 'an iron door at the back of the laboratory',
              backPassage: 'the iron door back to the laboratory',
              hidden: false,
              requires: 'iron_vault_key',
              oneWay: false,
              duration: null,
            },
          ],
          entrance: false,
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
            skill: 'brawling',
            damage: '1D4+2',
            damageModifier: 'full',
            special: 'impaling',
          },
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
          initialHolder: null,
        },
      ],
    },
  ],
}
