import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { AbandonGameDialog, DeleteCharacterDialog, DeleteGameDialog } from './dialogs'

const STATE = { open: true, pending: false, error: null, onConfirm: () => {}, onClose: () => {} }

describe('AbandonGameDialog', () => {
  test('says the game fails and cannot be resumed', () => {
    const html = renderToStaticMarkup(<AbandonGameDialog {...STATE} scenario="A Gascon in Paris" />)

    expect(html).toContain('Abandon this scenario?')
    expect(html).toContain('A Gascon in Paris ends in failure: the game cannot be resumed.')
    expect(html).toContain('Keep playing')
  })

  test('shows a refusal while a turn is being played', () => {
    const html = renderToStaticMarkup(
      <AbandonGameDialog
        {...STATE}
        scenario="A Gascon in Paris"
        error="A turn is already being played for this game."
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('A turn is already being played for this game.')
  })
})

describe('DeleteGameDialog', () => {
  test('names the failed game by its scenario', () => {
    const html = renderToStaticMarkup(<DeleteGameDialog {...STATE} scenario="The Golden Lion" />)

    expect(html).toContain('Delete this game?')
    expect(html).toContain('The failed game of The Golden Lion leaves this page for good.')
  })
})

describe('DeleteCharacterDialog', () => {
  test('names the character, and waits while the request is under way', () => {
    const html = renderToStaticMarkup(
      <DeleteCharacterDialog {...STATE} pending name="Anne de Breuil" />
    )

    expect(html).toContain('Delete this character?')
    expect(html).toContain('Anne de Breuil leaves your list for good')
    expect(html).toContain('Deleting…')
  })
})
