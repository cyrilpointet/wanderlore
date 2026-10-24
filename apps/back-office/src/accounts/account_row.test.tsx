import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { AccountRow } from './account_row'
import type { Account } from './queries'

const PLAYER: Account = {
  id: 'a1',
  fullName: 'Ada Player',
  email: 'ada@wanderlore.test',
  role: 'player',
  status: 'active',
  suspendedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
}

function render(account: Account, options: { isSelf?: boolean; error?: string } = {}) {
  return renderToStaticMarkup(
    <AccountRow
      account={account}
      isSelf={options.isSelf ?? false}
      pending={false}
      error={options.error}
      onSuspend={() => {}}
      onReactivate={() => {}}
    />
  )
}

describe('AccountRow', () => {
  test('shows who, with what role and status, and offers to suspend', () => {
    const html = render(PLAYER)

    for (const text of ['Ada Player', 'ada@wanderlore.test', 'Player', 'Active', 'Suspend']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('Reactivate')
  })

  test('offers to reactivate a suspended account, and says since when', () => {
    const html = render({ ...PLAYER, status: 'suspended', suspendedAt: '2026-10-20T10:00:00.000Z' })

    expect(html).toContain('Suspended')
    expect(html).toContain('Reactivate')
    expect(html).toContain('2026')
  })

  test('offers nothing on one’s own account', () => {
    const html = render({ ...PLAYER, role: 'superadmin' }, { isSelf: true })

    expect(html).toContain('You')
    expect(html).not.toContain('Suspend')
  })

  test('says why an action was refused', () => {
    expect(render(PLAYER, { error: 'The last active superadmin cannot be suspended.' })).toContain(
      'The last active superadmin cannot be suspended.'
    )
  })
})
