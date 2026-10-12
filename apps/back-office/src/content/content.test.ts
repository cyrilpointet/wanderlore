import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ApiError } from '@/api/client'
import { errorUnder, formFailureOf } from './form_errors'
import { labelsOf, rowsOf } from './labels'
import { isReference, suggestReference } from './references'

describe('labels', () => {
  test('lists English first, then the other languages', () => {
    expect(rowsOf({ en: 'Paris', it: 'Parigi', fr: 'Paris' })).toEqual([
      { language: 'en', name: 'Paris' },
      { language: 'fr', name: 'Paris' },
      { language: 'it', name: 'Parigi' },
    ])
  })

  test('drops incomplete rows, keeps English even empty', () => {
    expect(
      labelsOf([
        { language: 'en', name: ' ' },
        { language: ' FR ', name: ' Taverne ' },
        { language: 'de', name: '' },
        { language: '', name: 'Orphan' },
      ])
    ).toEqual({ en: '', fr: 'Taverne' })
  })
})

describe('references', () => {
  test('proposes one from an English name', () => {
    expect(suggestReference("Cardinal's Guard")).toBe('cardinals_guard')
    expect(suggestReference('Hôtel de Tréville')).toBe('hotel_de_treville')
    expect(suggestReference('1625 Paris')).toBe('x_1625_paris')
    expect(suggestReference('!!!')).toBe('')
  })

  test('accepts what the backend accepts', () => {
    expect(isReference('melee_combat')).toBe(true)
    expect(isReference('Melee')).toBe(false)
    expect(isReference('_melee')).toBe(false)
  })
})

describe('formFailureOf', () => {
  test('puts each validation error on its field, in the interface language', () => {
    const error = new ApiError(422, undefined, 'raw', {
      errors: [
        { field: 'skills.0.attribute', rule: 'regex', message: 'raw' },
        { field: 'labels.en', rule: 'english_label', message: 'raw' },
        { field: 'combat.weapon', rule: 'brand_new_rule', message: 'Backend says no' },
      ],
    })

    expect(formFailureOf(error)).toEqual({
      fields: {
        'skills.0.attribute': 'Lower-case letters, digits and underscores, starting with a letter.',
        'labels.en': 'An English name is required.',
        'combat.weapon': 'Backend says no',
      },
      general: null,
    })
  })

  test('puts a refusal tied to a field on that field', () => {
    const error = new ApiError(409, 'reference_taken', 'raw', {
      error: { code: 'reference_taken', message: 'raw', details: { field: 'reference' } },
    })

    expect(formFailureOf(error)).toEqual({
      fields: { reference: 'This reference is already taken.' },
      general: null,
    })
  })

  test('says anything else above the form', () => {
    const error = new ApiError(409, 'content_in_use', 'raw', {
      error: { code: 'content_in_use', message: 'raw', details: { kind: 'skill', references: [] } },
    })

    expect(formFailureOf(error)).toEqual({
      fields: {},
      general: 'Games are played with this: it cannot be removed.',
    })
  })

  test('finds an error nested under a path', () => {
    expect(errorUnder({ 'skills.0.attribute': 'Bad' }, 'skills.0')).toBe('Bad')
    expect(errorUnder({ 'skills.0.attribute': 'Bad' }, 'skills.1')).toBeUndefined()
  })
})
