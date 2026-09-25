import { ArrowDown, Dice5, Heart, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Margin } from '@/api/enums'
import { paragraphs } from './presentation'
import type { Game, Roll, Turn } from './queries'
import { useStickToBottom } from './use_stick_to_bottom'

/**
 * The story, oldest first, read like a book rather than a chat: no bubbles,
 * the narration full width in the reading serif.
 */
export function Journal({ game, turns }: { game: Game; turns: Turn[] }) {
  const { t } = useTranslation('game')
  const { ref, hasNew, scrollToBottom } = useStickToBottom<HTMLDivElement>(turns.length)

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-reading px-4 py-8 sm:px-6 lg:py-12">
          {turns.length === 0 ? (
            <Welcome game={game} />
          ) : (
            <ol aria-label={t('journal.label')} className="flex flex-col gap-12">
              {turns.map((turn) => (
                <li key={turn.id}>
                  <TurnEntry turn={turn} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {hasNew && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-3 px-3 py-1.5 text-label text-text transition-colors hover:border-accent"
        >
          {t('journal.newMessage')}
          <ArrowDown aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}

function TurnEntry({ turn }: { turn: Turn }) {
  return (
    <article className="flex flex-col gap-6">
      <PlayerAction text={turn.playerInput} />
      {turn.roll && <RollChip roll={turn.roll} />}
      {turn.narration && <Narration text={turn.narration} />}
      {turn.effects && <Effects effects={turn.effects} />}
    </article>
  )
}

/** The player's own words, in the interface sans — never the narration's serif. */
export function PlayerAction({ text }: { text: string }) {
  const { t } = useTranslation('game')

  return (
    <div className="border-l-2 border-accent pl-4">
      <p className="text-meta text-subtle uppercase">{t('journal.you')}</p>
      <p className="mt-1 text-body whitespace-pre-line text-text">{text}</p>
    </div>
  )
}

const ROLL_TONE = {
  success: 'border-success/40 bg-success/10 text-success',
  failure: 'border-danger/40 bg-danger/10 text-danger',
}

/** Critical outcomes stand out, a narrow success stays quiet. */
const MARGIN_EMPHASIS: Record<Margin, string> = {
  critical_success: 'font-semibold',
  comfortable: '',
  narrow: 'opacity-80',
  minor_failure: '',
  critical_failure: 'font-semibold',
}

/**
 * Which skill was rolled and how it went — never a number. The colour only
 * doubles the words, it never carries the outcome alone.
 */
export function RollChip({ roll }: { roll: Roll }) {
  const { t } = useTranslation('game')

  return (
    <p className="flex justify-center">
      <span
        className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1 text-label ${ROLL_TONE[roll.result]} ${MARGIN_EMPHASIS[roll.margin]}`}
      >
        <Dice5 aria-hidden className="size-4 shrink-0" />
        {t('journal.roll', {
          skill: roll.skill.label,
          outcome: t(`margin.${roll.margin}`, { ns: 'enums' }),
        })}
      </span>
    </p>
  )
}

/** Shown as text, never as HTML: it comes from an LLM fed with the player's words. */
export function Narration({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4 font-serif text-narration text-text lg:text-narration-lg">
      {paragraphs(text).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}

/** What changed, as the backend reports it. Scenario flags never reach here. */
export function Effects({ effects }: { effects: NonNullable<Turn['effects']> }) {
  const { t } = useTranslation('game')

  if (effects.hitPointsDelta === 0 && !effects.movement) return null

  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-label">
      {effects.hitPointsDelta !== 0 && (
        <li className="flex items-center gap-1.5 text-danger">
          <Heart aria-hidden className="size-4" />
          {t('effects.hitPoints', { delta: effects.hitPointsDelta })}
        </li>
      )}
      {effects.movement && (
        <li className="flex items-center gap-1.5 text-muted">
          <MapPin aria-hidden className="size-4" />
          {t('effects.movement', { location: effects.movement.label })}
        </li>
      )}
    </ul>
  )
}

/** A game with no turn yet: who, where, what for — and an invitation. */
function Welcome({ game }: { game: Game }) {
  const { t } = useTranslation('game')
  const [quest] = game.activeQuests

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <h2 className="font-serif text-[2rem] leading-tight font-medium text-text">
        {game.character.name}
      </h2>
      {game.location && (
        <p className="mt-2 flex items-center gap-1.5 text-body text-muted">
          <MapPin aria-hidden className="size-4" />
          {game.location.label}
        </p>
      )}
      {quest && (
        <div className="mt-8">
          <p className="text-body font-medium text-text">{quest.label}</p>
          {quest.summary && (
            <p className="mt-1.5 font-serif text-body text-muted">{quest.summary}</p>
          )}
        </div>
      )}
      <div aria-hidden className="my-8 w-12 border-t border-border-strong" />
      <p className="font-serif text-narration-lg text-text italic">{t('journal.welcome')}</p>
    </div>
  )
}
