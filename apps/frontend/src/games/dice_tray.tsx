import type { ReactNode } from 'react'

import { TRAY } from '@/components/surfaces'
import { RollCard } from './roll_card'
import type { LiveRoll } from './roll_reveal'

/**
 * The dice tray, recessed in the table and tucked under the sheet's lower
 * edge (front spec, section 8), holding the input slip. While a roll waits for
 * its dice, the tray grows and the roll is played out in it; once revealed,
 * the roll is on the sheet and the tray holds the slip alone. On a phone it
 * closes the screen; from `lg`, it sits under the sheet.
 */
export function DiceTray({
  live,
  onThrow,
  onDiceStopped,
  onFolded,
  children,
}: {
  /** The roll whose dice are waiting, being thrown, or landing. */
  live: LiveRoll | null
  onThrow: () => void
  onDiceStopped: () => void
  onFolded: () => void
  /** The input slip, or what replaces it once the game is over. */
  children: ReactNode
}) {
  return (
    <section
      className={`${TRAY} relative z-0 -mx-0.5 -mt-3.5 flex shrink-0 flex-col gap-2.5 rounded-b-none px-2.5 pt-[26px] pb-[max(10px,env(safe-area-inset-bottom))] lg:mx-3 lg:rounded-t-none lg:rounded-b-[14px] lg:px-3.5 lg:pt-7 lg:pb-3.5 lg:[grid-area:dock] ${
        live ? 'gap-3 lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-5 lg:gap-y-3.5' : ''
      }`}
    >
      {live && (
        <RollCard
          // A fresh card for each roll of the turn, the attack then the defence.
          key={live.done.length}
          live={live}
          onThrow={onThrow}
          onDiceStopped={onDiceStopped}
          onFolded={onFolded}
        />
      )}
      <div className={live ? 'lg:col-span-2' : 'min-w-0'}>{children}</div>
    </section>
  )
}
