import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { D10 } from '@/components/dice'
import { Stamp } from '@/components/stamp'
import { LABEL, TRAY } from '@/components/surfaces'
import { percentileDice } from './presentation'
import type { Roll } from './queries'
import { RollCard } from './roll_card'
import type { LiveRoll } from './roll_reveal'
import { rollText, stampText } from './roll_text'

/**
 * The dice tray, recessed in the table and tucked under the sheet's lower
 * edge (front spec, section 8): the last roll at rest on its two d10, then the
 * input slip — or, while a roll waits for its dice, the tray grows and the
 * roll is played out in it. On a phone it closes the screen; from `lg`, it
 * sits under the sheet, its contents on one line.
 */
export function DiceTray({
  live,
  last,
  onThrow,
  onDiceStopped,
  onFolded,
  children,
}: {
  /** The roll whose dice are waiting, being thrown, or landing. */
  live: LiveRoll | null
  /** The last roll already revealed, at rest in the tray; null before any. */
  last: Roll | null
  onThrow: () => void
  onDiceStopped: () => void
  onFolded: () => void
  /** The input slip, or what replaces it once the game is over. */
  children: ReactNode
}) {
  return (
    <section
      className={`${TRAY} relative z-0 -mx-0.5 -mt-3.5 flex shrink-0 flex-col gap-2.5 rounded-b-none px-2.5 pt-[26px] pb-[max(10px,env(safe-area-inset-bottom))] lg:mx-3 lg:rounded-t-none lg:rounded-b-[14px] lg:px-3.5 lg:pt-7 lg:pb-3.5 lg:[grid-area:dock] ${
        live
          ? 'gap-3 lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-5 lg:gap-y-3.5'
          : 'lg:flex-row lg:items-center lg:gap-4'
      }`}
    >
      {live ? (
        <RollCard
          // A fresh card for each roll of the turn, the attack then the defence.
          key={live.done.length}
          live={live}
          onThrow={onThrow}
          onDiceStopped={onDiceStopped}
          onFolded={onFolded}
        />
      ) : (
        <LastRoll roll={last} />
      )}
      <div className={live ? 'lg:col-span-2' : 'min-w-0 lg:flex-1'}>{children}</div>
    </section>
  )
}

/**
 * The last roll at rest: its two d10 as they fell, what it was and its stamp.
 * Before the first roll of a game, the dice lie blank.
 */
function LastRoll({ roll }: { roll: Roll | null }) {
  const { t } = useTranslation('game')
  const dice = roll ? percentileDice(roll.roll) : null
  const text = roll ? rollText(roll, t) : null

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 pr-1 pl-1.5 lg:gap-4">
      <div aria-hidden className="flex gap-3.5">
        {[
          { label: t('journal.roll.tens'), face: dice ? `${dice.tens}0` : null },
          { label: t('journal.roll.units'), face: dice ? `${dice.units}` : null },
        ].map((die) => (
          <span key={die.label} className="flex flex-col items-center gap-1">
            <D10 size="small" face={die.face} />
            <span className={`${LABEL} text-[0.625rem]`}>{die.label}</span>
          </span>
        ))}
      </div>
      {roll && text && (
        // The roll is told in full on the sheet: here, a reminder for the eye only.
        <div
          aria-hidden
          className="flex flex-col items-end gap-1.5 text-right text-[0.78125rem] leading-tight text-muted tabular-nums"
        >
          <span>
            <span className="font-semibold text-text">{text.heading ?? text.setup[0]}</span>
            {' · '}
            {text.rolled}
          </span>
          <Stamp tone={roll.result === 'success' ? 'success' : 'failure'}>{stampText(text)}</Stamp>
        </div>
      )}
    </div>
  )
}
