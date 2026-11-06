import { Link } from '@tanstack/react-router'

import { AccountMenu } from '@/components/account_menu'
import { PAGE } from '@/components/layout'
import { Wordmark } from '@/components/wordmark'

/**
 * The top of every page outside a game: no app bar, only the wordmark and the
 * account token lying on the table (front spec, section 8).
 */
export function AppHeader() {
  return (
    <header className={`${PAGE} flex items-center justify-between pt-[18px] lg:pt-7`}>
      <Link to="/" className="rounded-sm">
        <Wordmark />
      </Link>
      <AccountMenu />
    </header>
  )
}
