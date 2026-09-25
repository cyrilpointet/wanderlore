import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { currentUserQuery } from '@/auth/session'

/**
 * Every route under this layout requires a signed-in player. Without one, the
 * player signs in first and comes back to the page they asked for.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQuery)

    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    return { user }
  },
  component: Outlet,
})
