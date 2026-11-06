import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'

import { useAnimates } from '@/preferences'

export type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

/**
 * Every page fades in, briefly, as the player moves from one to the next —
 * unless they or their system turned the "Panels and pages" animation off.
 * A fade only: no movement that would shift what is being read.
 */
function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const fades = useAnimates('transitions')

  return (
    // Keyed on the page, so the fade plays again at each arrival.
    <div key={pathname} className={fades ? 'animate-page-in' : undefined}>
      <Outlet />
    </div>
  )
}
