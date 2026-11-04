import { ContentLabels, inLanguage } from '#services/game/content_labels'
import { loadWorldLevel } from '#services/game/content/load'
import {
  creatableWorlds,
  creationWorldOf,
  findCreatableWorld,
} from '#services/game/character_creation'
import { POWER_LEVEL_SCALE, PERSONAL_POINTS_PER_INT } from '#services/rules/power_levels'
import { CHARACTERISTIC_FLOOR, NAME_MAX_LENGTH } from '#services/rules/character_creation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The worlds a player can create a character in: those with a scenario they
 * may play. Names in English until the player can pick a language (Phase 14).
 */
export default class WorldsController {
  async index({ auth }: HttpContext) {
    const worlds = await creatableWorlds(auth.getUserOrFail())

    return {
      data: worlds.map((world) => ({
        id: world.id,
        reference: world.reference,
        label: inLanguage(world.labels, 'en'),
        tone: world.narrativeTone,
      })),
    }
  }

  /**
   * What creating a character in the world takes: its level and what the
   * level gives, its professions, its skills and what each is worth
   * untrained. Every reference with its label; the front computes nothing.
   */
  async creation({ params, auth }: HttpContext) {
    const world = await findCreatableWorld(auth.getUserOrFail(), params.worldId)
    const { professions } = await creationWorldOf(world)
    const labels = new ContentLabels(await loadWorldLevel(world.id))
    const scale = POWER_LEVEL_SCALE[world.powerLevel]

    return {
      data: {
        world: { id: world.id, ...labels.world(), tone: world.narrativeTone },
        powerLevel: world.powerLevel,
        professionalPoints: scale.professionalPoints,
        skillCap: scale.skillCap,
        personalPointsPerInt: PERSONAL_POINTS_PER_INT,
        characteristicFloor: CHARACTERISTIC_FLOOR,
        nameMaxLength: NAME_MAX_LENGTH,
        professions: professions.map((profession) => ({
          ...labels.of('profession', profession.reference),
          description: profession.description,
          skills: profession.skills.map((skill) => labels.of('skill', skill)),
          startingItems: profession.startingItems.map((item) => ({
            item: labels.of('item', item.definition),
            quantity: item.quantity,
            equipped: item.equipped,
          })),
          startingResources: labels.valued('resource', profession.startingResources),
        })),
        skills: world.skills.map((skill) => ({
          ...labels.of('skill', skill.reference),
          category: skill.category,
          baseChance: skill.baseChance,
        })),
      },
    }
  }
}
