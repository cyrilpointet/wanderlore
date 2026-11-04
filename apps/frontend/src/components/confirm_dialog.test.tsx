import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ConfirmDialog } from './confirm_dialog'

function render(state: { pending?: boolean; error?: string | null } = {}) {
  return renderToStaticMarkup(
    <ConfirmDialog
      open
      pending={state.pending ?? false}
      error={state.error ?? null}
      title="Burn the letter?"
      body="It cannot be read again."
      cancelLabel="Keep it"
      confirmLabel="Burn"
      pendingLabel="Burning…"
      onConfirm={() => {}}
      onClose={() => {}}
    />
  )
}

describe('ConfirmDialog', () => {
  test('asks, says what follows, and offers both ways', () => {
    const html = render()

    expect(html).toContain('Burn the letter?')
    expect(html).toContain('It cannot be read again.')
    expect(html).toContain('Keep it')
    expect(html).toContain('>Burn<')
    expect(html).not.toContain('role="alert"')
  })

  test('puts the button that changes nothing first, where focus lands', () => {
    const html = render()

    expect(html.indexOf('Keep it')).toBeLessThan(html.indexOf('>Burn<'))
  })

  test('says the request is under way, and lets nothing else be pressed meanwhile', () => {
    const html = render({ pending: true })

    expect(html).toContain('Burning…')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  test('shows why the request failed', () => {
    expect(render({ error: 'Connection lost.' })).toContain('Connection lost.')
  })
})
