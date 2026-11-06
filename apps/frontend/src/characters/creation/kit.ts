import type { TFunction } from 'i18next'

import type { Profession } from '../queries'

/**
 * What a profession starts a game with, item by item then resource by
 * resource, worded for the player: the same on the profession's card and on
 * the finished character's.
 */
export function kitOf(profession: Profession, t: TFunction<'characters'>): string[] {
  return [
    ...profession.startingItems.map(({ item, quantity, equipped }) =>
      t(equipped ? 'creation.profession.itemEquipped' : 'creation.profession.item', {
        item: item.label,
        count: quantity,
      })
    ),
    ...profession.startingResources.map(({ label, value }) =>
      t('creation.profession.resource', { resource: label, value })
    ),
  ]
}
