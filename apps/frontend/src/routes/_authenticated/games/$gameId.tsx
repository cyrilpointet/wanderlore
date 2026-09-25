import { createFileRoute } from '@tanstack/react-router'

import { AppHeader } from '@/components/app_header'

/** The game screen — built in KAN-24; for now, only the place the list leads to. */
export const Route = createFileRoute('/_authenticated/games/$gameId')({
  component: Game,
})

function Game() {
  return <AppHeader />
}
