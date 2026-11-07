import { describe, expect, test } from 'vitest'

import i18n from './index'
import { errorMessage } from './errors'
import {
  ATTACK_OUTCOMES,
  CHARACTERISTICS,
  CONTEXTUAL_EFFECTS,
  DEFENSE_OUTCOMES,
  DEFENSES,
  DEGREES,
  DIFFICULTIES,
  END_REASONS,
  GAME_STATUSES,
  GENDERS,
  ITEM_CHANGES,
  PERIODS,
  RESULTS,
  SKILL_CATEGORIES,
  SCENARIO_STATUSES,
  SPECIAL_EFFECTS,
  STEPS,
  TURN_STATUSES,
} from '@/api/enums'

describe('i18n', () => {
  test.each([
    ['gameStatus', GAME_STATUSES],
    ['endReason', END_REASONS],
    ['gender', GENDERS],
    ['turnStatus', TURN_STATUSES],
    ['step', STEPS],
    ['result', RESULTS],
    ['degree', DEGREES],
    ['difficulty', DIFFICULTIES],
    ['contextualEffect', CONTEXTUAL_EFFECTS],
    ['defense', DEFENSES],
    ['attackOutcome', ATTACK_OUTCOMES],
    ['defenseOutcome', DEFENSE_OUTCOMES],
    ['specialEffect', SPECIAL_EFFECTS],
    ['characteristic', CHARACTERISTICS],
    ['characteristicShort', CHARACTERISTICS],
    ['skillCategory', SKILL_CATEGORIES],
    ['itemChange', ITEM_CHANGES],
    ['scenarioStatus', SCENARIO_STATUSES],
    ['period', PERIODS],
  ])('labels every %s value', (group, values) => {
    for (const value of values) {
      expect(i18n.exists(`${group}.${value}`, { ns: 'enums' }), `${group}.${value}`).toBe(true)
    }
  })

  test('translates a known error code rather than showing the API message', () => {
    expect(errorMessage({ code: 'llm_timeout', message: 'raw API text' })).toBe(
      'The game master took too long to answer. Try your action again.'
    )
  })

  test('falls back on the API message for a code it does not know yet', () => {
    expect(errorMessage({ code: 'brand_new_code', message: 'raw API text' })).toBe('raw API text')
  })

  test('falls back on a generic message when the API sent none', () => {
    expect(errorMessage({ code: 'brand_new_code' })).toBe('Something went wrong.')
  })
})
