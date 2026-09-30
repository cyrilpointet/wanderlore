import { THREE_MUSKETEERS, type WorldDefinition } from './world.js'

/**
 * The content of `resolution_rules`, written in code until the Phase 5
 * back-office takes over. Changing a rule means changing this file and
 * re-running the seeder, which writes it to every environment.
 *
 * Everything is in English: the description is handed to arbitration, never
 * shown to the player.
 */
export type ResolutionRuleContent = {
  /** Stable English reference arbitration picks from a closed list. */
  actionType: string
  /** One sentence on what the category covers, for arbitration. */
  description: string
  /** Reference of the world skill that resolves the category. */
  associatedSkill: string
}

export type WorldResolutionRules = {
  world: WorldDefinition
  rules: ResolutionRuleContent[]
}

/**
 * One category per use of each skill. The rules document warns that the
 * fewer and flatter the categories, the more reliably arbitration lands an
 * action on exactly one of them.
 */
const THREE_MUSKETEERS_RULES: ResolutionRuleContent[] = [
  {
    actionType: 'melee_combat',
    description:
      'Fighting at close quarters, with a sword, a dagger, bare fists or whatever is at hand.',
    associatedSkill: 'swordsmanship',
  },
  {
    actionType: 'ranged_combat',
    description: 'Shooting or throwing at a target: pistol, musket, thrown knife or stone.',
    associatedSkill: 'marksmanship',
  },
  {
    actionType: 'physical_feat',
    description:
      'Climbing, jumping, running, swimming, riding hard, or forcing a door by strength.',
    associatedSkill: 'athletics',
  },
  {
    actionType: 'sneaking',
    description: 'Moving unseen or unheard, hiding, shadowing someone, or lifting a purse.',
    associatedSkill: 'stealth',
  },
  {
    actionType: 'perception',
    description: 'Noticing, searching, spotting a detail or a lie, or reading a scene.',
    associatedSkill: 'observation',
  },
  {
    actionType: 'knowledge',
    description:
      'Recalling or working out what learning teaches: law, heraldry, history, medicine, a cipher.',
    associatedSkill: 'scholarship',
  },
  {
    actionType: 'social_persuasion',
    description: 'Winning someone over by argument, charm or an appeal to their interest.',
    associatedSkill: 'persuasion',
  },
  {
    actionType: 'social_intimidation',
    description: "Getting one's way through threats, menace or sheer force of presence.",
    associatedSkill: 'intimidation',
  },
  {
    actionType: 'social_deception',
    description: "Lying, bluffing, or disguising oneself or one's intentions.",
    associatedSkill: 'deception',
  },
  {
    actionType: 'social_etiquette',
    description: 'Behaving as rank and custom demand: at court, before a superior, among nobles.',
    associatedSkill: 'etiquette',
  },
]

export const RESOLUTION_RULES: WorldResolutionRules[] = [
  { world: THREE_MUSKETEERS, rules: THREE_MUSKETEERS_RULES },
]
