import { ArrowDown, Dice5, Heart, MapPin, Package } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { paragraphs } from './presentation'
import type { Game, ItemChangeEffect, Roll, Turn } from './queries'
import { DEGREE_EMPHASIS, ROLL_TONE, rollLine, rollText } from './roll_text'
import { useStickToBottom } from './use_stick_to_bottom'

/**
 * The story, oldest first, read like a book rather than a chat: no bubbles,
 * the narration full width in the reading serif.
 */
export function Journal({
  game,
  turns,
  inFlight,
  progress,
}: {
  game: Game
  turns: Turn[]
  /** The turn being played, if any, after the story so far. */
  inFlight?: ReactNode
  /** Changes whenever the turn in flight moves on, so the journal follows it. */
  progress?: string
}) {
  const { t } = useTranslation('game')
  const { ref, hasNew, scrollToBottom } = useStickToBottom<HTMLDivElement>(
    `${turns.length}:${progress ?? ''}`
  )

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-reading px-4 py-8 sm:px-6 lg:py-12">
          {turns.length === 0 && !inFlight ? (
            <Welcome game={game} />
          ) : (
            <ol aria-label={t('journal.label')} className="flex flex-col gap-12">
              {turns.map((turn) => (
                <li key={turn.id}>
                  <TurnEntry turn={turn} />
                </li>
              ))}
              {inFlight && <li>{inFlight}</li>}
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

/**
 * The roll in full, as at the table: what was rolled and at how much, the
 * difficulty when it is not average, each modifier with its value, the chance
 * when it moved, the d100 and the degree. Every number comes from the backend;
 * the colour only doubles the words, it never carries the outcome alone.
 */
export function RollChip({ roll }: { roll: Roll }) {
  const { t } = useTranslation('game')

  return (
    <p className="flex justify-center">
      <span
        className={`inline-flex flex-wrap items-center justify-center gap-x-2 rounded-sm border px-3 py-1 text-label ${ROLL_TONE[roll.result]} ${DEGREE_EMPHASIS[roll.degree]}`}
      >
        <Dice5 aria-hidden className="size-4 shrink-0" />
        {rollLine(rollText(roll, t))}
      </span>
    </p>
  )
}

/**
 * Shown as text, never as HTML: it comes from an LLM fed with the player's words.
 *
 * `provisional` while it is still being written. It grows outside any live
 * region, so a screen reader is not read the whole text again at every
 * fragment: the waiting message announces the step, and the finished
 * narration is announced once the turn completes.
 *
 * `fadeIn` once, as it appears: the animation plays when the element is
 * mounted, never again as fragments make it grow.
 */
export function Narration({
  text,
  provisional = false,
  fadeIn = false,
}: {
  text: string
  provisional?: boolean
  fadeIn?: boolean
}) {
  return (
    <div
      aria-busy={provisional || undefined}
      className={`flex flex-col gap-4 font-serif text-narration text-text lg:text-narration-lg ${fadeIn ? 'animate-fade-in' : ''}`}
    >
      {paragraphs(text).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}

/** What changed, as the backend reports it. Scenario flags never reach here. */
export function Effects({ effects }: { effects: NonNullable<Turn['effects']> }) {
  const { t } = useTranslation('game')

  if (effects.hitPointsDelta === 0 && !effects.movement && effects.items.length === 0) {
    return null
  }

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
      {effects.items.map((change, index) => (
        <li key={index} className="flex items-center gap-1.5 text-muted">
          <Package aria-hidden className="size-4" />
          <ItemChangeText change={change} />
        </li>
      ))}
    </ul>
  )
}

/** "You get the sword from Bernajoux", "Lead shot ×2 goes to the tavern". */
function ItemChangeText({ change }: { change: ItemChangeEffect }) {
  const { t } = useTranslation('game')
  const item =
    change.quantity > 1
      ? t('effects.quantity', { item: change.item.label, count: change.quantity })
      : change.item.label

  return (
    <>
      {t(`itemChange.${change.change}`, {
        ns: 'enums',
        item,
        counterpart: change.counterpart?.label,
        context: change.counterpart ? 'counterpart' : undefined,
      })}
    </>
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
