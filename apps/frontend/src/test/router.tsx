import type { ReactNode } from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from '@tanstack/react-router'

/**
 * A router for components rendered in tests: links need one to build their
 * `href`. Nothing is matched or loaded — the component under test is the
 * whole page.
 */
export function withRouter(children: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return <RouterContextProvider router={router}>{children}</RouterContextProvider>
}
