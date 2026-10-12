import { useTranslation } from 'react-i18next'

const SIZES = {
  // Headers: 16 px (front spec, section 8).
  default: 'text-base',
  // The sign-in screen, where it is the whole identity of the page.
  large: 'text-[1.625rem] leading-none',
}

export function Wordmark({ size = 'default' }: { size?: keyof typeof SIZES }) {
  const { t } = useTranslation()

  return (
    <span className={`font-serif font-medium uppercase tracking-[0.22em] text-text ${SIZES[size]}`}>
      {t('appName')}
    </span>
  )
}
