import { createFileRoute, redirect } from '@tanstack/react-router'

import { HOME } from '@/auth/session'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: HOME })
  },
})
