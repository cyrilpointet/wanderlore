import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { currentUserQuery, signOut } from '@/auth/session'
import { failureMessage } from '@/i18n/errors'

/**
 * The player's initials, opening their name and **Sign out**.
 *
 * A disclosure rather than an ARIA menu: two plain elements do not need the
 * arrow-key contract a `role="menu"` would promise.
 */
export function AccountMenu() {
  const { t } = useTranslation('auth')
  const { data: user } = useQuery(currentUserQuery)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.setQueryData(currentUserQuery.queryKey, null)
      await navigate({ to: '/login' })
      // Nothing read as this player may outlive their session.
      queryClient.clear()
    },
  })

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (!user) return null

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={t('accountMenu')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 place-items-center rounded-full border border-border-strong bg-surface-2 text-label font-medium text-muted transition-colors hover:text-text"
      >
        {user.initials}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border-strong bg-surface-3 p-1"
        >
          <div className="px-3 py-2">
            <p className="truncate text-body text-text">{user.fullName ?? user.email}</p>
            {user.fullName && <p className="truncate text-label text-muted">{user.email}</p>}
          </div>
          <div className="my-1 border-t border-border-strong" />
          <button
            type="button"
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body text-text transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            <LogOut aria-hidden className="size-4 text-muted" />
            {t('signOut')}
          </button>
          {signOutMutation.error && (
            <p role="alert" className="px-3 py-2 text-label text-danger">
              {failureMessage(signOutMutation.error)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
