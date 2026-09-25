import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import './styles.css'
import './i18n'
import { ApiError, onUnauthorized } from './api/client'
import { closeTransmit } from './api/transmit'
import { currentUserQuery } from './auth/session'
import { watchSystemTheme } from './theme'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // An answer from the API will not change by asking again; a dropped connection might.
      retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 2,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/**
 * A missing or expired session sends the player to sign in, then back to
 * where they were (front spec, section 4, step 6).
 */
onUnauthorized(() => {
  // Forgotten first, or `/login` would still see a signed-in player and send them straight back.
  queryClient.setQueryData(currentUserQuery.queryKey, null)
  closeTransmit()

  const { pathname, href } = router.state.location
  if (pathname === '/login') return
  void router.navigate({ to: '/login', search: { redirect: href } })
})

watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
