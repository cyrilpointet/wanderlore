import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Hit points at a glance: `8 / 10`. Always brick red — green means a
 * successful roll, never health (front spec, section 8).
 */
export function HitPoints({ current, max }: { current: number; max: number }) {
  const { t } = useTranslation()

  return (
    <span className="flex items-center gap-1.5 text-label">
      <Heart aria-hidden className="size-4 text-danger" />
      <span aria-hidden className="text-text">
        {t('hitPoints.value', { current, max })}
      </span>
      <span className="sr-only">{t('hitPoints.label', { current, max })}</span>
    </span>
  )
}
