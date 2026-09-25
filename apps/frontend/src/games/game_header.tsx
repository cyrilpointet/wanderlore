import { Link } from '@tanstack/react-router'
import { ArrowLeft, IdCard, Volume2, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AccountMenu } from '@/components/account_menu'
import { HitPoints } from '@/components/hit_points'
import { HitPointGauge } from './hit_point_gauge'
import type { Game } from './queries'

/**
 * Who is playing and how they fare. Hit points stay visible at every size;
 * the sheet button only exists where the sheet is not already on screen.
 */
export function GameHeader({
  game,
  onOpenSheet,
  voice,
}: {
  game: Game
  onOpenSheet: () => void
  /** Reading the narration aloud; no button where the browser cannot speak. */
  voice: { supported: boolean; enabled: boolean; setEnabled: (enabled: boolean) => void }
}) {
  const { t } = useTranslation('game')
  const { character } = game

  return (
    <header className="shrink-0 border-b border-border bg-surface-1">
      <div className="flex h-16 items-center gap-2 px-2 sm:gap-4 sm:px-6">
        <Link
          to="/games"
          className="flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-label text-muted transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-5 sm:size-4" />
          <span className="sr-only sm:not-sr-only">{t('backToGames')}</span>
        </Link>
        <div aria-hidden className="hidden h-6 border-l border-border-strong sm:block" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-lg leading-tight font-medium text-text">
            {character.name}
          </h1>
          {game.chapter ? (
            <>
              {/* On a phone, where the story stands matters more than which world it is. */}
              <p className="truncate text-label text-muted sm:hidden">{game.chapter.label}</p>
              <p className="hidden truncate text-label text-muted sm:block">
                {t('worldAndChapter', {
                  ns: 'games',
                  world: game.world.label,
                  chapter: game.chapter.label,
                })}
              </p>
            </>
          ) : (
            <p className="truncate text-label text-muted">{game.world.label}</p>
          )}
        </div>

        <div className="flex h-9 shrink-0 items-center gap-3 rounded-lg border border-border bg-surface-2 px-2.5 sm:px-3">
          <HitPoints current={character.hitPoints} max={character.hitPointsMax} />
          <HitPointGauge
            current={character.hitPoints}
            max={character.hitPointsMax}
            className="hidden w-16 sm:block"
          />
        </div>

        {voice.supported && (
          <button
            type="button"
            onClick={() => voice.setEnabled(!voice.enabled)}
            aria-label={t('voice.label')}
            aria-pressed={voice.enabled}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:text-text"
          >
            {voice.enabled ? (
              <Volume2 aria-hidden className="size-5" />
            ) : (
              <VolumeX aria-hidden className="size-5" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSheet}
          aria-label={t('openSheet')}
          aria-haspopup="dialog"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:text-text lg:hidden"
        >
          <IdCard aria-hidden className="size-5" />
        </button>

        <AccountMenu />
      </div>
    </header>
  )
}
