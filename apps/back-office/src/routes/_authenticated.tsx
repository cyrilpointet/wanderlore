import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { canUseBackOffice, currentUserQuery } from '@/auth/session'

/**
 * Every route under this layout requires a signed-in game master. Anyone else
 * goes to the sign-in page: to sign in, or to be told this account cannot use
 * the back-office. The backend refuses them on every request regardless.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQuery)

    if (!canUseBackOffice(user)) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    return { user }
  },
  component: Outlet,
})
