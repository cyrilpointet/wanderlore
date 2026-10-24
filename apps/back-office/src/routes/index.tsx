import { createFileRoute, redirect } from '@tanstack/react-router'

import { canUseBackOffice, currentUserQuery } from '@/auth/session'
import { homeOf } from '@/auth/sections'

/** Each role to its own home: the worlds for a game master, the accounts for a superadmin. */
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQuery)

    throw canUseBackOffice(user) ? redirect({ to: homeOf(user.role) }) : redirect({ to: '/login' })
  },
})
