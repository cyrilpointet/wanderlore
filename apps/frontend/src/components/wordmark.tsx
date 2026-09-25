import { useTranslation } from 'react-i18next'

export function Wordmark() {
  const { t } = useTranslation()

  return (
    <span className="font-serif text-base font-medium uppercase tracking-[0.22em] text-text">
      {t('appName')}
    </span>
  )
}
