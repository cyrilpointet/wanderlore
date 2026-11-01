import { MapPin, SunMoon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Game } from './queries'

/**
 * Where and when the scene is, always in view above the story: the place and
 * the period of the day. Never the hour nor the date: the story gives them, to
 * a character with a way to know them.
 */
export function SceneBar({ game }: { game: Game }) {
  const { t } = useTranslation('game')
  const { t: enums } = useTranslation('enums')

  return (
    <div className="shrink-0 border-b border-border">
      <dl className="mx-auto flex w-full max-w-reading items-center gap-3 px-4 py-2 text-label text-muted sm:px-6">
        <div className="flex min-w-0 items-center">
          <dt className="sr-only">{t('scene.location')}</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <MapPin aria-hidden className="size-4 shrink-0" />
            <span className="truncate text-text">
              {game.location?.label ?? t('scene.noLocation')}
            </span>
          </dd>
        </div>
        <span aria-hidden className="text-subtle">
          ·
        </span>
        <div className="flex shrink-0 items-center">
          <dt className="sr-only">{t('scene.period')}</dt>
          <dd className="flex items-center gap-1.5">
            <SunMoon aria-hidden className="size-4 shrink-0" />
            {enums(`period.${game.period}`)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
