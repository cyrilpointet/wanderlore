import { Link } from '@tanstack/react-router'
import { ChevronLeft, Volume2, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AccountMenu } from '@/components/account_menu'
import { ICON_BUTTON_GHOST } from '@/components/actions'
import { HitPoints } from '@/components/hit_points'
import { CARD, LABEL } from '@/components/surfaces'
import { SHEET_TABS, type SheetTab } from './sheet_tabs'
import type { Game } from './queries'

/**
 * Who is playing and how they fare (front spec, section 8). On a phone, the
 * character's card at the top of the table — name, hit points — with the
 * three tabs of the sheet hanging under it, each lifting the sheet open on its
 * card; from `lg`, a bar above the table, the hit points beside the way back,
 * so they stay in view whichever card of the sheet is on top.
 */
export function GameHeader({
  game,
  onOpenSheet,
  voice,
}: {
  game: Game
  /** Lifts the sheet open on one of its cards, on a phone. */
  onOpenSheet: (tab: SheetTab) => void
  /** Reading the narration aloud; no button where the browser cannot speak. */
  voice: { supported: boolean; enabled: boolean; setEnabled: (enabled: boolean) => void }
}) {
  const { t } = useTranslation('game')
  const { character } = game

  return (
    <header className="relative z-30 shrink-0 pt-2.5 lg:mb-[34px] lg:pt-0 lg:[grid-area:top]">
      <div
        className={`relative flex flex-col gap-1.5 ${CARD} py-[9px] pr-2.5 pl-1.5 lg:flex-row lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-[22px]">
          <Link
            to="/characters/$characterId"
            params={{ characterId: game.characterId }}
            className={`${ICON_BUTTON_GHOST} lg:flex lg:size-auto lg:items-center lg:gap-1 lg:rounded-sm lg:text-label lg:font-medium lg:text-muted`}
          >
            <ChevronLeft aria-hidden className="size-5 lg:size-4" />
            <span className="sr-only lg:hidden">{t('backToCharacter')}</span>
            <span className="hidden lg:inline">{character.name}</span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-serif text-[1.1875rem] leading-tight font-semibold text-text lg:sr-only">
            {character.name}
          </h1>
          <HitPoints
            current={character.hitPoints}
            max={character.hitPointsMax}
            className="hidden lg:flex"
          />
          <span aria-hidden className="hidden lg:block lg:flex-1" />

          {voice.supported && (
            <button
              type="button"
              onClick={() => voice.setEnabled(!voice.enabled)}
              aria-label={t('voice.label')}
              aria-pressed={voice.enabled}
              className={`${ICON_BUTTON_GHOST} lg:border lg:border-border-strong lg:bg-card`}
            >
              {voice.enabled ? (
                <Volume2 aria-hidden className="size-[18px]" />
              ) : (
                <VolumeX aria-hidden className="size-[18px]" />
              )}
            </button>
          )}
          <span className="lg:ml-1">
            <AccountMenu />
          </span>
        </div>

        <div className="flex items-center justify-between gap-2.5 pr-0.5 pl-2.5 lg:hidden">
          <span aria-hidden className={`${LABEL} shrink-0 whitespace-nowrap`}>
            {t('sheet.hitPoints')}
          </span>
          <HitPoints current={character.hitPoints} max={character.hitPointsMax} />
        </div>
      </div>

      {/* The tabs of the sheet, hanging under the card: each one lifts the sheet open on its card. */}
      <div role="group" aria-label={t('openSheet')} className="flex gap-1 pl-3 lg:hidden">
        {SHEET_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onOpenSheet(tab)}
            aria-haspopup="dialog"
            className="-mt-px rounded-b-[7px] border border-t-0 border-border-strong bg-card-under px-3.5 pt-[7px] pb-[7px] text-[0.6875rem] leading-none font-semibold tracking-[0.08em] text-muted uppercase shadow-card transition-colors hover:bg-card hover:text-text"
          >
            {t(`sheet.tabs.${tab}`)}
          </button>
        ))}
      </div>
    </header>
  )
}
