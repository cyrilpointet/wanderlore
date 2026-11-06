import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { closeTransmit } from '@/api/transmit'
import { currentUserQuery, signOut } from '@/auth/session'
import { failureMessage } from '@/i18n/errors'
import { PreferencesDialog } from './preferences_dialog'
import { LIFTED } from './surfaces'

const ITEM =
  'flex w-full items-center gap-2.5 rounded-[4px] p-2.5 text-left text-[0.90625rem] leading-none font-medium text-text transition-colors hover:bg-card-under disabled:opacity-60'

/**
 * The player's initials as a token lying on the table, opening a small card
 * lifted under it: who is signed in, **Preferences** and **Sign out**.
 *
 * A disclosure rather than an ARIA menu: two plain elements do not need the
 * arrow-key contract a `role="menu"` would promise.
 */
export function AccountMenu() {
  const { t } = useTranslation(['auth', 'preferences'])
  const { data: user } = useQuery(currentUserQuery)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.setQueryData(currentUserQuery.queryKey, null)
      closeTransmit()
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
        // A token: card fill, a double ring, its own shadow on the table.
        className="grid size-9 place-items-center rounded-full border border-border-strong bg-card text-[0.71875rem] leading-none font-bold tracking-[0.04em] text-muted shadow-[inset_0_0_0_3px_var(--wl-card),inset_0_0_0_4px_var(--wl-leader),var(--wl-shadow-card)] transition-colors hover:text-text"
      >
        {user.initials}
      </button>

      {open && (
        <div
          id={panelId}
          className={`${LIFTED} absolute top-[46px] right-0 z-40 flex w-60 flex-col p-1.5`}
        >
          <div className="mb-1 border-b border-border p-2.5">
            {user.fullName && (
              <p className="truncate text-label font-medium text-text">{user.fullName}</p>
            )}
            <p className="truncate text-label text-subtle">{user.email}</p>
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setOpen(false)
              setPreferencesOpen(true)
            }}
            className={ITEM}
          >
            <Settings aria-hidden className="size-[18px] text-muted" />
            {t('open', { ns: 'preferences' })}
          </button>
          <button
            type="button"
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
            className={ITEM}
          >
            <LogOut aria-hidden className="size-[18px] text-muted" />
            {t('signOut')}
          </button>
          {signOutMutation.error && (
            <p role="alert" className="p-2.5 text-label text-danger">
              {failureMessage(signOutMutation.error)}
            </p>
          )}
        </div>
      )}

      <PreferencesDialog
        open={preferencesOpen}
        onClose={() => {
          setPreferencesOpen(false)
          // The menu that opened it is gone: back to the button that opens the menu.
          trigger.current?.focus()
        }}
      />
    </div>
  )
}
