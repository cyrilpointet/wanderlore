import { useTranslation } from 'react-i18next'

import { PlaceTag } from '@/components/place_tag'
import type { Game } from './queries'

/**
 * Where and when the scene is: a paper tag pinned on the sheet's top edge,
 * always in view above the story (front spec, section 8) — the place and the
 * period of the day, then the world and the scenario. Never the hour nor the
 * date: the story gives them, to a character with a way to know them.
 */
export function SceneTag({ game, className = '' }: { game: Game; className?: string }) {
  const { t } = useTranslation('game')
  const { t: enums } = useTranslation('enums')

  return (
    <PlaceTag
      className={className}
      title={
        <>
          <span className="sr-only">{t('scene.location')}: </span>
          {game.location?.label ?? t('scene.noLocation')}
          <span aria-hidden> — </span>
          <span className="sr-only">, {t('scene.period')}: </span>
          {enums(`period.${game.period}`)}
        </>
      }
      subtitle={[game.world.label, game.scenario.title].join(t('separator', { ns: 'characters' }))}
    />
  )
}
