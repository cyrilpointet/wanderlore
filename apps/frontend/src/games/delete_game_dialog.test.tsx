import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { DeleteGameDialog } from './delete_game_dialog'

function render(state: { deleting?: boolean; error?: string | null } = {}) {
  return renderToStaticMarkup(
    <DeleteGameDialog
      characterName="d'Artagnan"
      open
      deleting={state.deleting ?? false}
      error={state.error ?? null}
      onConfirm={() => {}}
      onClose={() => {}}
    />
  )
}

describe('DeleteGameDialog', () => {
  test('names the game by its character, and says it cannot be resumed', () => {
    const html = render()

    expect(html).toContain('Delete this game?')
    expect(html).toContain('The game of d&#x27;Artagnan leaves your list for good')
    expect(html).toContain('Keep it')
    expect(html).toContain('Delete')
    expect(html).not.toContain('role="alert"')
  })

  test('puts the button that keeps the game first, where focus lands', () => {
    const html = render()

    expect(html.indexOf('Keep it')).toBeLessThan(html.indexOf('>Delete<'))
  })

  test('says the game is being deleted, and lets nothing else be pressed meanwhile', () => {
    const html = render({ deleting: true })

    expect(html).toContain('Deleting…')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  test('shows why the deletion failed', () => {
    expect(render({ error: 'Connection lost.' })).toContain('Connection lost.')
  })
})
