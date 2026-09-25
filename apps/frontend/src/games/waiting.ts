import type { TFunction } from 'i18next'

import type { TurnState } from './turn_machine'

/**
 * What the game master is doing, in words: the step it last announced, or
 * that it has the action in hand. Shown in the journal and told to screen
 * readers.
 */
export function waitingText(
  state: Extract<TurnState, { status: 'in_progress' }>,
  t: TFunction<'game'>
): string {
  return state.step ? t(`step.${state.step}`, { ns: 'enums' }) : t('journal.considering')
}
