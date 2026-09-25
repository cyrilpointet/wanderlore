import { createFileRoute } from '@tanstack/react-router'

import { Wordmark } from '@/components/wordmark'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <Wordmark />
    </main>
  )
}
