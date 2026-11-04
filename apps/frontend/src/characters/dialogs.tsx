import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm_dialog'

type RequestState = {
  open: boolean
  pending: boolean
  /** Why the last attempt failed, already worded for the player. */
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/** Before giving up a game: it fails, and cannot be resumed. */
export function AbandonGameDialog({ scenario, ...state }: RequestState & { scenario: string }) {
  const { t } = useTranslation('characters')

  return (
    <ConfirmDialog
      {...state}
      title={t('abandonDialog.title')}
      body={t('abandonDialog.body', { scenario })}
      cancelLabel={t('abandonDialog.cancel')}
      confirmLabel={t('abandonDialog.confirm')}
      pendingLabel={t('abandonDialog.pending')}
    />
  )
}

/** Before a failed game leaves the character's page. */
export function DeleteGameDialog({ scenario, ...state }: RequestState & { scenario: string }) {
  const { t } = useTranslation('characters')

  return (
    <ConfirmDialog
      {...state}
      title={t('deleteGameDialog.title')}
      body={t('deleteGameDialog.body', { scenario })}
      cancelLabel={t('deleteGameDialog.cancel')}
      confirmLabel={t('deleteGameDialog.confirm')}
      pendingLabel={t('deleteGameDialog.pending')}
    />
  )
}

/** Before a character leaves the player's list, with the games they played. */
export function DeleteCharacterDialog({ name, ...state }: RequestState & { name: string }) {
  const { t } = useTranslation('characters')

  return (
    <ConfirmDialog
      {...state}
      title={t('deleteCharacterDialog.title')}
      body={t('deleteCharacterDialog.body', { name })}
      cancelLabel={t('deleteCharacterDialog.cancel')}
      confirmLabel={t('deleteCharacterDialog.confirm')}
      pendingLabel={t('deleteCharacterDialog.pending')}
    />
  )
}
