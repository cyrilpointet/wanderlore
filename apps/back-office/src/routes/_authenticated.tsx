import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { canUseBackOffice, currentUserQuery } from '@/auth/session'
import { canVisit, homeOf } from '@/auth/sections'

/**
 * Every route under this layout requires a signed-in game master or
 * superadmin, and belongs to the sections of one of the two: anyone else
 * goes to the sign-in page, and a section of the other role sends back to
 * one's own home. The backend refuses them on every request regardless.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQuery)

    if (!canUseBackOffice(user)) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    if (!canVisit(user.role, location.pathname)) {
      throw redirect({ to: homeOf(user.role) })
    }

    return { user }
  },
  component: Outlet,
})
