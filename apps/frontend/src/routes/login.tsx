import { createFileRoute } from '@tanstack/react-router'

import { Wordmark } from '@/components/wordmark'

type LoginSearch = {
  /** Where to go back to once signed in. */
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: Login,
})

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <Wordmark />
    </main>
  )
}
