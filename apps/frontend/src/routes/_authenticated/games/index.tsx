import { createFileRoute, redirect } from '@tanstack/react-router'

/** *My games* gave way to the characters' home in Phase 12: an old link lands there. */
export const Route = createFileRoute('/_authenticated/games/')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})
