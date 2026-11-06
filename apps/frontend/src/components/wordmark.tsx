import { useTranslation } from 'react-i18next'

const SIZES = {
  // Lying on the table, top left of every page outside a game.
  default: 'text-[0.8125rem] tracking-[0.24em]',
  // The sign-in screen, where it is the whole identity of the page. The
  // negative margin takes back the tracking after the last letter, so it centres.
  large: 'text-[1.625rem] tracking-[0.26em] -mr-[0.26em]',
}

/** **WANDERLORE**: Literata, capitals, spaced (front spec, section 8). */
export function Wordmark({ size = 'default' }: { size?: keyof typeof SIZES }) {
  const { t } = useTranslation()

  return (
    <span className={`font-serif leading-none font-semibold text-text uppercase ${SIZES[size]}`}>
      {t('appName')}
    </span>
  )
}
