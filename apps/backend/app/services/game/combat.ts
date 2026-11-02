import { baseChanceOf, damageModifierFor } from '#services/rules/derived'
import {
  DOWN_AT,
  bestDefense,
  defenseOptions,
  hitDegreeOf,
  woundOf,
  type DefenseOption,
  type RulesEngine,
} from '#services/rules/engine'
import type {
  Characteristics,
  ContextualModifier,
  Defense,
  Fumble,
  HitDegree,
  HitResolution,
  RollBase,
  RollResolution,
  Weapon,
  WeaponKind,
  Wound,
} from '#services/rules/types'

import { type HeldItem, modifierSources } from './inventory.js'
import { resolutionFor, rollBaseFor, type RollingSheet } from './resolution_rules.js'
import { DODGE, MELEE_COMBAT, RANGED_COMBAT } from './system_references.js'
import type { NpcDefinition, WorldDefinition } from './world.js'
import type { CombatEngagement } from './prompts/types.js'

/**
 * A round of combat (roadmap, Phase 10), worked out by the backend alone: one
 * turn, the character first, then the riposte of the one they fight — the
 * advantage always goes to the player. Pure: the scene comes in loaded, the
 * dice through the rules engine, and what happened goes out for the turn's
 * transaction to apply. The model never sees a number of it.
 */

/** A round lasts the book's twelve seconds, whatever arbitration proposed. */
export const ROUND_SECONDS = 12

/**
 * A character brought down is out of the fight for an hour — the book's
 * unconsciousness after a serious wound — captured, left for dead or helped,
 * as the narration has it.
 */
export const DOWN_SECONDS = 60 * 60

/** Fists, when nothing better is at hand: the book's Brawl, crushing on a special. */
export const BARE_HANDS: Weapon = {
  reference: null,
  kind: 'melee',
  damage: '1D3',
  damageModifier: 'full',
  special: 'crushing',
}

/** A stone, a bottle, whatever is thrown when nothing meant for it is held. */
export const THROWN_OBJECT: Weapon = {
  reference: null,
  kind: 'thrown',
  damage: '1D3',
  damageModifier: 'half',
  special: null,
}

/**
 * The characteristics a person is taken to have when a skill's base chance
 * reads one: the ordinary adult of the book, 10 in everything. A person has
 * no characteristics of their own; their sheet gives what matters.
 */
const ORDINARY_CHARACTERISTIC = 10

/** Someone the character fights, as the round reads them. */
export type Opponent = {
  handle: string
  definition: NpcDefinition
  hitPoints: number
  bleeding: boolean
  dying: boolean
  /** What they hold: a weapon outranks their ordinary one, an armour their ordinary armour. */
  items: HeldItem[]
}

export type RoundInput = {
  world: WorldDefinition
  character: RollingSheet & { hitPoints: number; hitPointsMax: number; bleeding: boolean }
  /** What the character holds: their weapon, their armour, the modifiers of their defence. */
  characterItems: HeldItem[]
  opponent: Opponent
  engagement: CombatEngagement
  /**
   * The character's attack as already rolled on its category, with the
   * category; null when they meet an open attack without striking.
   */
  attack: { actionType: string; resolution: RollResolution } | null
}

/** A defence rolled, and which one. */
export type RolledDefense = { defense: Defense; resolution: RollResolution }

/** An item that left its holder's hand: dropped where the fight is, or broken. */
export type LostWeapon = {
  holder: 'character' | 'opponent'
  item: HeldItem
  fate: 'dropped' | 'broken'
}

/** One side's blow, from the attack to what it did. */
export type Blow = {
  /** The weapon's definition; null for bare hands or a thrown object. */
  weapon: string | null
  /** Null when the attacker struck without a defence being rolled: a miss, a target down. */
  defense: RolledDefense | null
  landed: HitDegree | null
  hit: HitResolution | null
  wound: Wound
  /** The attacker's fumble, then the defender's. */
  fumble: Fumble | null
  defenderFumble: Fumble | null
}

export type CombatantState = 'fighting' | 'down' | 'dying' | 'dead'

export type Round = {
  opponent: string
  /** The character's blow; null when they only met an attack. */
  characterBlow: Blow | null
  /** The riposte, rolled by the backend, never shown; null when the opponent could not strike. */
  riposte: (Blow & { attack: RollResolution }) | null
  /** The opponent never saw the blow coming: no defence against it, and no riposte this round. */
  opponentCaughtUnaware: boolean
  /**
   * Standing and aware, the opponent still could not reach the character this
   * round, as arbitration judged: no riposte.
   */
  opponentOutOfReach: boolean
  character: {
    hitPoints: number
    /** Every point lost this round, a fumble's and a bleeding's included. */
    damage: number
    bleeding: boolean
    /** Down at 2 hit points or fewer: out of the fight. */
    down: boolean
    /** Brought to 0 or below: never killed — back at 1, captured, left for dead or helped. */
    out: boolean
  }
  opponentAfter: {
    hitPoints: number
    damage: number
    bleeding: boolean
    state: CombatantState
  }
  lostWeapons: LostWeapon[]
}

/**
 * The round, end to end: the character's blow if they strike, the hidden
 * defence it meets — none when the opponent never saw it coming — its
 * damage; then, if the opponent still stands, was neither stopped nor caught
 * unaware, and can reach the character, their hidden riposte and the
 * character's defence — the better of what the scene allows, rolled for
 * them. Then the bleeding of earlier rounds.
 */
export function playRound(rules: RulesEngine, input: RoundInput): Round {
  const { world, opponent, engagement } = input
  const profile = opponent.definition.combat
  const characterArmor = armorOf(
    world,
    input.characterItems.filter(({ equipped }) => equipped)
  )
  const opponentArmor = opponentArmorOf(world, opponent)
  const opponentWeapon = opponentWeaponOf(world, opponent)
  const lostWeapons: LostWeapon[] = []

  let characterHp = input.character.hitPoints
  let characterBleeding = input.character.bleeding
  let opponentHp = opponent.hitPoints
  let opponentBleeding = opponent.bleeding
  let opponentDead = false
  let stopped = false
  let characterFell = false

  let characterBlow: Blow | null = null
  /** Surprise is the character's to spring: a round they only defend in has none. */
  const caughtUnaware = input.attack !== null && !engagement.opponent_aware

  if (input.attack !== null) {
    const weapon = characterWeaponOf(world, input.characterItems, input.attack.actionType)
    const attack = input.attack.resolution
    const opponentCanDefend = !opponent.dying && opponentHp > DOWN_AT && !caughtUnaware
    const defense =
      attack.result === 'success' && opponentCanDefend
        ? rollDefense(
            rules,
            defenseOptions(weapon.weapon.kind, {
              parry: canParryWith(opponentWeapon.weapon)
                ? npcBase(world, opponent.definition, skillOf(world, MELEE_COMBAT))
                : null,
              dodge: npcBase(world, opponent.definition, DODGE),
            }),
            {
              contextual: engagement.opponent_defense_modifiers,
              items: modifierSources(world, opponent.items),
            }
          )
        : null
    const landed = hitDegreeOf(attack.degree, defense?.resolution.degree ?? null)
    const hit =
      landed === null
        ? null
        : rules.resolveHit({
            weapon: weapon.weapon,
            damageModifier: damageModifierFor(input.character.characteristics),
            degree: landed,
            armor: opponentArmor,
          })
    const before = opponentHp

    if (hit !== null) {
      opponentHp -= hit.total
      opponentBleeding ||= hit.bleeding
      stopped = hit.stopped
      /** A blow on someone already dying finishes them. */
      opponentDead = opponent.dying && hit.total > 0
    }

    const fumble = attack.degree === 'fumble' ? rollFumbleOf(rules, world, weapon.item) : null
    if (fumble === 'self_injury') characterHp -= rules.selfInjury(weapon.weapon, characterArmor)
    if (fumble === 'fall') characterFell = true
    if (fumble !== null) lostWeapons.push(...lost(fumble, 'character', weapon.item))

    const defenderFumble =
      defense?.resolution.degree === 'fumble'
        ? rollFumbleOf(rules, world, opponentWeapon.item)
        : null
    if (defenderFumble !== null)
      lostWeapons.push(...lost(defenderFumble, 'opponent', opponentWeapon.item))

    characterBlow = {
      weapon: weapon.weapon.reference,
      defense,
      landed,
      hit,
      wound: woundOf(before - opponentHp, profile.hitPointsMax, opponentHp),
      fumble,
      defenderFumble,
    }
  }

  const opponentStands = !opponent.dying && opponentHp > DOWN_AT && !stopped
  let riposte: Round['riposte'] = null

  if (opponentStands && !caughtUnaware && engagement.riposte_possible) {
    const category = opponentWeapon.weapon.kind === 'melee' ? MELEE_COMBAT : RANGED_COMBAT
    const attack = rules.resolve(
      npcBase(world, opponent.definition, skillOf(world, category)),
      characterFell ? 'easy' : 'average',
      { contextual: [], items: modifierSources(world, opponent.items) }
    )
    const characterMelee = characterWeaponOf(world, input.characterItems, MELEE_COMBAT)
    const defense =
      attack.result === 'success'
        ? rollDefense(
            rules,
            defenseOptions(opponentWeapon.weapon.kind, {
              parry:
                engagement.parry_possible && characterMelee.item !== null
                  ? rollBaseFor(world, resolutionFor(world, MELEE_COMBAT), input.character)
                  : null,
              dodge: engagement.dodge_possible
                ? rollBaseFor(world, { kind: 'skill', skill: DODGE }, input.character)
                : null,
            }),
            {
              contextual: engagement.defense_modifiers,
              items: modifierSources(world, input.characterItems),
            }
          )
        : null
    const landed = hitDegreeOf(attack.degree, defense?.resolution.degree ?? null)
    const hit =
      landed === null
        ? null
        : rules.resolveHit({
            weapon: opponentWeapon.weapon,
            damageModifier: profile.damageModifier,
            degree: landed,
            armor: characterArmor,
          })
    const before = characterHp

    if (hit !== null) {
      characterHp -= hit.total
      characterBleeding ||= hit.bleeding
    }

    const fumble =
      attack.degree === 'fumble' ? rollFumbleOf(rules, world, opponentWeapon.item) : null
    if (fumble === 'self_injury')
      opponentHp -= rules.selfInjury(opponentWeapon.weapon, opponentArmor)
    if (fumble !== null) lostWeapons.push(...lost(fumble, 'opponent', opponentWeapon.item))

    const defenderFumble =
      defense?.resolution.degree === 'fumble'
        ? rollFumbleOf(rules, world, characterMelee.item)
        : null
    if (defenderFumble !== null)
      lostWeapons.push(...lost(defenderFumble, 'character', characterMelee.item))

    riposte = {
      attack,
      weapon: opponentWeapon.weapon.reference,
      defense,
      landed,
      hit,
      wound: woundOf(before - characterHp, input.character.hitPointsMax, characterHp),
      fumble,
      defenderFumble,
    }
  }

  /** A wound bleeds from the round after it was dealt: what bled before this one goes on. */
  if (input.character.bleeding) characterHp -= 1
  if (opponent.bleeding && !opponentDead) opponentHp -= 1

  const out = characterHp <= 0

  return {
    opponent: opponent.handle,
    characterBlow,
    riposte,
    opponentCaughtUnaware: caughtUnaware,
    opponentOutOfReach: opponentStands && !caughtUnaware && !engagement.riposte_possible,
    character: {
      hitPoints: out ? 1 : characterHp,
      damage: input.character.hitPoints - characterHp,
      bleeding: characterBleeding,
      down: characterHp <= DOWN_AT,
      out,
    },
    opponentAfter: {
      hitPoints: opponentHp,
      damage: opponent.hitPoints - opponentHp,
      bleeding: opponentBleeding,
      state: opponentDead
        ? 'dead'
        : opponentHp <= 0
          ? 'dying'
          : opponentHp <= DOWN_AT
            ? 'down'
            : 'fighting',
    },
    lostWeapons: dedupe(lostWeapons),
  }
}

/** The defence rolled for whoever meets a blow: the better of those possible, none if none is. */
function rollDefense(
  rules: RulesEngine,
  options: DefenseOption[],
  modifiers: { contextual: ContextualModifier[]; items: ReturnType<typeof modifierSources> }
): RolledDefense | null {
  const chosen = bestDefense(options, modifiers)

  return chosen === null
    ? null
    : {
        defense: chosen.defense,
        resolution: rules.resolve(chosen.base, chosen.difficulty, modifiers),
      }
}

/** A weapon in hand parries; bare hands, a thrown object or a firearm do not. */
function canParryWith(weapon: Weapon): boolean {
  return weapon.reference !== null && weapon.kind !== 'projectile'
}

/** The kinds of weapon an attack of each category is made with. */
const FITS: Record<string, WeaponKind[]> = {
  [MELEE_COMBAT]: ['melee', 'thrown'],
  [RANGED_COMBAT]: ['thrown', 'projectile'],
}

/**
 * The character's weapon for an attack of this category: what they have drawn
 * first, else what they hold that fits; else bare hands — or, at range,
 * whatever comes to hand to throw.
 */
export function characterWeaponOf(
  world: WorldDefinition,
  items: HeldItem[],
  actionType: string
): { weapon: Weapon; item: HeldItem | null } {
  const fits = FITS[actionType] ?? FITS[MELEE_COMBAT]
  const weapons = items
    .map((item) => ({ item, weapon: weaponProfileOf(world, item.definition) }))
    .filter(
      (entry): entry is { item: HeldItem; weapon: Weapon } =>
        entry.weapon !== null && fits.includes(entry.weapon.kind)
    )
  const chosen = weapons.find(({ item }) => item.equipped) ?? weapons[0]

  if (chosen !== undefined) {
    return chosen
  }

  return { weapon: actionType === RANGED_COMBAT ? THROWN_OBJECT : BARE_HANDS, item: null }
}

/** A person's weapon: one they hold outranks their ordinary one; bare hands without either. */
export function opponentWeaponOf(
  world: WorldDefinition,
  opponent: Pick<Opponent, 'definition' | 'items'>
): { weapon: Weapon; item: HeldItem | null } {
  for (const item of opponent.items) {
    const weapon = weaponProfileOf(world, item.definition)

    if (weapon !== null) {
      return { weapon, item }
    }
  }

  const ordinary = opponent.definition.combat.weapon

  return {
    weapon: (ordinary === null ? null : weaponProfileOf(world, ordinary)) ?? BARE_HANDS,
    item: null,
  }
}

function weaponProfileOf(world: WorldDefinition, reference: string): Weapon | null {
  const definition = world.items.find((item) => item.reference === reference)

  return definition?.weapon ? { reference, ...definition.weapon } : null
}

/** The best armour worn: several do not add up. */
export function armorOf(world: WorldDefinition, worn: HeldItem[]): number {
  return Math.max(
    0,
    ...worn.map(
      ({ definition }) => world.items.find((item) => item.reference === definition)?.armor ?? 0
    )
  )
}

/** A person's ordinary armour, unless they hold a better one — a person never equips. */
function opponentArmorOf(world: WorldDefinition, opponent: Opponent): number {
  const held = armorOf(world, opponent.items)

  return held > 0 ? held : opponent.definition.combat.armor
}

/** The skill an attacking category is resolved with: a skill, as the coherence checks demand. */
function skillOf(world: WorldDefinition, actionType: string): string {
  const resolution = resolutionFor(world, actionType)

  if (resolution.kind !== 'skill') {
    throw new Error(`"${actionType}" of the ${world.reference} world is not resolved by a skill.`)
  }

  return resolution.skill
}

/**
 * What a person has in a skill: their sheet's value, or its base chance in
 * this world — read, when it is a multiple of a characteristic, on an
 * ordinary adult's.
 */
export function npcBase(
  world: WorldDefinition,
  definition: NpcDefinition,
  skill: string
): RollBase {
  const trained = definition.combat.skills[skill]

  if (trained !== undefined) {
    return { kind: 'skill', skill, value: trained }
  }

  const entry = world.skills.find(({ reference }) => reference === skill)
  const ordinary = Object.fromEntries(
    ['STR', 'CON', 'SIZ', 'INT', 'POW', 'DEX', 'CHA'].map((name) => [name, ORDINARY_CHARACTERISTIC])
  ) as Characteristics

  return { kind: 'skill', skill, value: entry ? baseChanceOf(entry.baseChance, ordinary) : 0 }
}

/**
 * A fumble on the reduced table. A weapon held as an item can be dropped; a
 * weapon that is not unique can break too — a quest blade never does. Bare
 * hands and a person's ordinary weapon are no item: nothing to drop.
 */
function rollFumbleOf(rules: RulesEngine, world: WorldDefinition, item: HeldItem | null): Fumble {
  const unique =
    item !== null &&
    world.items.find((entry) => entry.reference === item.definition)?.kind === 'unique'

  return rules.rollFumble({ droppable: item !== null, breakable: item !== null && !unique })
}

function lost(fumble: Fumble, holder: LostWeapon['holder'], item: HeldItem | null): LostWeapon[] {
  if (item === null) return []
  if (fumble === 'weapon_dropped') return [{ holder, item, fate: 'dropped' }]
  if (fumble === 'weapon_broken') return [{ holder, item, fate: 'broken' }]

  return []
}

/** A weapon lost twice in a round is lost once: broken wins over dropped. */
function dedupe(weapons: LostWeapon[]): LostWeapon[] {
  const byItem = new Map<string, LostWeapon>()

  for (const weapon of weapons) {
    const key = `${weapon.holder}:${weapon.item.handle ?? weapon.item.definition}`
    const known = byItem.get(key)

    if (known === undefined || weapon.fate === 'broken') {
      byItem.set(key, weapon)
    }
  }

  return [...byItem.values()]
}

/** One blow as the narration is told it: what happened, never by how much. */
export type NarratedBlow = {
  landed: boolean
  /** How well it landed, once the defence had its say; null when it did not. */
  degree: HitDegree | null
  /** How the defender met it, whether or not that stopped it; null when they could not. */
  met_with: Defense | null
  wound: Wound
  effect: HitResolution['effect']
  /** What the attacker's fumble did, then the defender's. */
  fumble: Fumble | null
  defender_fumble: Fumble | null
}

/**
 * The round as the narration stages it (roadmap, Phase 10): labels only —
 * landed or not, how it was met, how badly it wounded, what fell or broke —
 * never the dice, the chances or the hit points.
 */
export type NarratedRound = {
  opponent: string
  character_blow: NarratedBlow | null
  /** Null when the opponent could not strike back: down, stopped, dying, unaware or out of reach. */
  opponent_blow: NarratedBlow | null
  /** They never saw the character's blow coming: no defence, and no answer this round. */
  opponent_caught_unaware: boolean
  /** They could not reach the character this round: out of reach, or out of their line of fire. */
  opponent_out_of_reach: boolean
  opponent_state: CombatantState
  /** `out`: brought down for good this round — captured, left for dead or helped, never killed. */
  character_state: 'fighting' | 'down' | 'out'
  character_bleeding: boolean
  opponent_bleeding: boolean
}

export function narratedRound(round: Round): NarratedRound {
  const blow = (played: Blow | null): NarratedBlow | null =>
    played === null
      ? null
      : {
          landed: played.landed !== null,
          degree: played.landed,
          met_with: played.defense?.defense ?? null,
          wound: played.wound,
          effect: played.hit?.effect ?? null,
          fumble: played.fumble === 'nothing' ? null : played.fumble,
          defender_fumble: played.defenderFumble === 'nothing' ? null : played.defenderFumble,
        }

  return {
    opponent: round.opponent,
    character_blow: blow(round.characterBlow),
    opponent_blow: blow(round.riposte),
    opponent_caught_unaware: round.opponentCaughtUnaware,
    opponent_out_of_reach: round.opponentOutOfReach,
    opponent_state: round.opponentAfter.state,
    character_state: round.character.out ? 'out' : round.character.down ? 'down' : 'fighting',
    character_bleeding: round.character.bleeding,
    opponent_bleeding: round.opponentAfter.bleeding,
  }
}
