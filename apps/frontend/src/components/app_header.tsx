import { AccountMenu } from '@/components/account_menu'
import { Wordmark } from '@/components/wordmark'

/** The header of every page outside a game: the wordmark and the account menu. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface-1">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <Wordmark />
        <AccountMenu />
      </div>
    </header>
  )
}
