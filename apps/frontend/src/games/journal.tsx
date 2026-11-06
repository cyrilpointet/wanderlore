import { ArrowDown, ArrowUp, CircleAlert } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Stamp } from '@/components/stamp'
import { CARD, LABEL } from '@/components/surfaces'
import { failureMessage } from '@/i18n/errors'
import { useAnimates } from '@/preferences'
import { paragraphs } from './presentation'
import type { Game, ItemChangeEffect, Roll, Turn } from './queries'
import { cardLine, damageLine, rollText, stampText } from './roll_text'
import { useStickToBottom } from './use_stick_to_bottom'

/** Loading the page of the story before the turns shown. */
export type EarlierTurns = {
  /** Earlier turns remain to be loaded. */
  remain: boolean
  load: () => void
  loading: boolean
  error: unknown
}

/**
 * The story, oldest first, written on the sheet of paper lying on the table
 * (front spec, section 8): no bubbles, the narration in the reading serif,
 * the player's words in the interface sans, each roll on a small card. A long
 * story opens on its last turns; earlier ones are loaded on demand, above.
 * It scrolls under the place tag pinned on the sheet, never behind it.
 */
export function Journal({
  game,
  turns,
  earlier,
  inFlight,
  progress,
  revealedTurnId,
}: {
  game: Game
  turns: Turn[]
  earlier?: EarlierTurns
  /** The turn being played, if any, after the story so far. */
  inFlight?: ReactNode
  /** Changes whenever the turn in flight moves on, so the journal follows it. */
  progress?: string
  /**
   * The turn that joined the journal once its dice were thrown: its
   * narration appears there, and fades in as any narration does.
   */
  revealedTurnId?: string | null
}) {
  const { t } = useTranslation('game')
  const fades = useAnimates('narration')
  // Keyed on the last turn: a page put in front is not news.
  const { ref, hasNew, scrollToBottom } = useStickToBottom<HTMLDivElement>(
    `${turns.at(-1)?.id ?? ''}:${progress ?? ''}`
  )
  // How far the reader stood from the end when they asked for earlier turns.
  const fromBottom = useRef<number | null>(null)
  const firstId = turns[0]?.id

  // Before paint, so the page put in front does not move what is being read.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || fromBottom.current === null) return

    element.scrollTop = element.scrollHeight - fromBottom.current
    fromBottom.current = null
  }, [ref, firstId])

  function loadEarlier() {
    const element = ref.current
    if (element) fromBottom.current = element.scrollHeight - element.scrollTop
    earlier?.load()
  }

  return (
    <div className="relative min-h-0 flex-1">
      {/*
       * Positioned itself, so what is placed absolutely in the story — the
       * words kept for screen readers — scrolls with it rather than stretching
       * the page below the table.
       */}
      <div
        ref={ref}
        className="relative h-full overflow-y-auto [scrollbar-width:thin] mask-[linear-gradient(transparent,#000_22px)]"
      >
        <div className="mx-auto w-full max-w-reading px-[18px] pt-3.5 pb-[30px] lg:px-14 lg:pt-[18px] lg:pb-[52px]">
          {turns.length === 0 && !inFlight ? (
            <Welcome game={game} />
          ) : (
            <>
              {earlier?.remain && (
                <LoadEarlier onLoad={loadEarlier} loading={earlier.loading} error={earlier.error} />
              )}
              <ol aria-label={t('journal.label')} className="flex flex-col gap-8">
                {turns.map((turn) => (
                  <li key={turn.id}>
                    <TurnEntry turn={turn} fadeIn={fades && turn.id === revealedTurnId} />
                  </li>
                ))}
                {inFlight && <li>{inFlight}</li>}
              </ol>
            </>
          )}
        </div>
      </div>

      {hasNew && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={`${CARD} absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-label font-medium text-text transition-colors hover:border-accent`}
        >
          {t('journal.newMessage')}
          <ArrowDown aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Above the story when earlier turns remain: loads the page before. */
export function LoadEarlier({
  onLoad,
  loading,
  error,
}: {
  onLoad: () => void
  loading: boolean
  error: unknown
}) {
  const { t } = useTranslation('game')

  return (
    <div className="mb-8 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        aria-busy={loading || undefined}
        className={`${CARD} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label font-medium text-text transition-colors hover:border-accent disabled:opacity-70`}
      >
        <ArrowUp aria-hidden className="size-4" />
        {loading ? t('journal.loadingEarlier') : t('journal.loadEarlier')}
      </button>
      {error != null && !loading && (
        <p role="alert" className="flex items-center gap-1.5 text-label text-danger">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {failureMessage(error)}
        </p>
      )}
    </div>
  )
}

function TurnEntry({ turn, fadeIn }: { turn: Turn; fadeIn: boolean }) {
  return (
    <article className="flex flex-col gap-3.5">
      <PlayerAction text={turn.playerInput} />
      <RollChips rolls={turn.rolls} />
      {turn.narration && <Narration text={turn.narration} fadeIn={fadeIn} />}
      {turn.effects && <Effects effects={turn.effects} />}
    </article>
  )
}

/** The player's own words, in the interface sans — never the narration's serif. */
export function PlayerAction({ text }: { text: string }) {
  const { t } = useTranslation('game')

  return (
    <p className="flex gap-[9px] text-body font-medium whitespace-pre-line text-text lg:text-base">
      <span aria-hidden className="font-bold text-accent">
        ›
      </span>
      <span className="min-w-0">
        <span className="sr-only">{t('journal.you')}: </span>
        {text}
      </span>
    </p>
  )
}

/** The rolls of a turn, one card each, in the order they were made: nothing without a roll. */
export function RollChips({ rolls, children }: { rolls: Roll[]; children?: ReactNode }) {
  if (rolls.length === 0 && !children) return null

  return (
    <div className="ml-3 flex flex-col gap-2 lg:ml-10 lg:max-w-[560px]">
      {rolls.map((roll, index) => (
        <RollChip key={index} roll={roll} />
      ))}
      {children}
    </div>
  )
}

/**
 * The roll in full, as at the table, on a small card laid straight on the
 * sheet: for a defence, which one; what was rolled and at how much, the
 * difficulty when it is not average, each modifier with its value, the chance
 * when it moved and the d100; the degree stamped, and in combat what it did;
 * the damage the blow dealt on a line of its own. Every number comes from the
 * backend; the colour only doubles the words, it never carries the outcome
 * alone.
 */
export function RollChip({ roll }: { roll: Roll }) {
  const { t } = useTranslation('game')
  const text = rollText(roll, t)
  const [first, ...rest] = cardLine(text)
  const success = roll.result === 'success'

  return (
    <div
      className={`${CARD} grid grid-cols-1 items-start gap-[7px] border-l-4 py-2.5 pr-3 pl-[13px] text-[0.8125rem] leading-[1.45] text-muted tabular-nums lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-3 lg:gap-y-1.5 lg:text-[0.84375rem] ${success ? 'border-l-success' : 'border-l-danger'}`}
    >
      <span className="min-w-0">
        <span className="font-semibold text-text">{first}</span>
        {rest.map((part, index) => (
          <span key={index}> · {part}</span>
        ))}
      </span>
      <Stamp
        tone={success ? 'success' : 'failure'}
        className="justify-self-start lg:justify-self-end"
      >
        {stampText(text)}
      </Stamp>
      {text.damage.length > 0 && (
        <span className="border-t border-dashed border-border pt-1.5 text-xs lg:col-span-2">
          {damageLine(text)}
        </span>
      )}
    </div>
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
      className={`flex flex-col gap-3 font-serif text-narration text-text lg:text-narration-lg ${fadeIn ? 'animate-fade-in' : ''}`}
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
    <ul className="flex flex-wrap gap-2">
      {effects.hitPointsDelta !== 0 && (
        <li className={`${TOKEN} bg-hp text-on-hp`}>
          {t('effects.hitPoints', { delta: effects.hitPointsDelta })}
        </li>
      )}
      {effects.movement && (
        <li className={`${TOKEN} border border-border-strong bg-card text-muted shadow-card`}>
          {t('effects.movement', { location: effects.movement.label })}
        </li>
      )}
      {effects.items.map((change, index) => (
        <li
          key={index}
          className={`${TOKEN} border border-border-strong bg-card text-muted shadow-card`}
        >
          <ItemChangeText change={change} />
        </li>
      ))}
    </ul>
  )
}

/** An effect of the turn: a round-ended token, brick for hit points, paper for the rest. */
const TOKEN =
  'inline-flex items-center rounded-full px-[11px] py-1 text-[0.78125rem] leading-tight font-semibold'

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

/**
 * A game with no turn yet: the first page of the scenario — the world and the
 * scenario, the chapter it opens on — and an invitation. The place is on the
 * tag above, the quest on the sheet.
 */
function Welcome({ game }: { game: Game }) {
  const { t } = useTranslation('game')
  const separator = t('separator', { ns: 'characters' })

  return (
    <div className="flex flex-col gap-2.5 pt-2.5 pb-1.5">
      <p className={LABEL}>
        {game.chapter ? [game.world.label, game.scenario.title].join(separator) : game.world.label}
      </p>
      <h2 className="font-serif text-[1.875rem] leading-[1.15] font-semibold text-text">
        {game.chapter?.label ?? game.scenario.title}
      </h2>
      <span aria-hidden className="mt-1.5 mb-1 h-0.5 w-[46px] bg-hp" />
      <p className="font-serif text-[1.0625rem] leading-relaxed text-muted italic">
        {t('journal.welcome')}
      </p>
    </div>
  )
}
