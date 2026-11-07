import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION, SECONDARY_ACTION, SMALL } from '@/components/actions'
import { CARD } from '@/components/surfaces'
import { errorMessage } from '@/i18n/errors'
import { useAnimates } from '@/preferences'
import { Ending, Narration, PlayerAction, RollChips } from './journal'
import { liveRollOf, type RevealState } from './roll_reveal'
import { emphasisOf } from './turn_errors'
import type { Failure, TurnState } from './turn_machine'
import { waitingText } from './waiting'

/**
 * The turn being played, at the end of the journal: the player's words right
 * away, then what the game master is doing — or the narration as it is
 * written — then, if it goes wrong, what happened and how to go on, the
 * provisional narration withdrawn. Gone once the turn joins the journal.
 *
 * A roll received live is played out in the dice tray (`DiceTray`), the
 * narration kept back here until the dice are thrown — those of every roll of
 * the turn, one after the other (front spec, section 5.3.7). Each roll joins
 * the sheet as a card once its dice have landed.
 *
 * On the turn that ends the game, the epilogue follows the narration as it
 * is written — kept back with it while the dice wait, so the end is never
 * told before them.
 */
export function TurnInFlight({
  state,
  reveal,
  onRetry,
  onEdit,
}: {
  state: Exclude<TurnState, { status: 'idle' }>
  reveal: RevealState
  onRetry: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation('game')
  const fadeIn = useAnimates('narration')
  const liveRoll = liveRollOf(reveal, state.submission.turnId)

  return (
    <article className="flex flex-col gap-3.5">
      <div>
        <PlayerAction text={state.submission.playerInput} />
        {state.status === 'submitting' && (
          <p className="mt-1.5 pl-[18px] text-meta text-subtle">{t('journal.sending')}</p>
        )}
      </div>

      {liveRoll ? (
        // The rolls already thrown: the one in the tray and those still to come stay off the sheet.
        <RollChips rolls={liveRoll.done} />
      ) : (
        (state.status === 'in_progress' || state.status === 'failed') && (
          <RollChips rolls={state.rolls} />
        )
      )}

      {state.status === 'in_progress' &&
        !liveRoll &&
        (state.narration ? (
          <Narration text={state.narration} provisional fadeIn={fadeIn} />
        ) : (
          <Waiting text={waitingText(state, t)} />
        ))}

      {state.status === 'in_progress' &&
        !liveRoll &&
        state.narration &&
        state.step === 'epilogue' &&
        (state.epilogue ? (
          <Ending
            gameEnd={{ reason: null, epilogue: state.epilogue }}
            provisional
            fadeIn={fadeIn}
          />
        ) : (
          <Waiting text={waitingText(state, t)} />
        ))}

      {(state.status === 'failed' || state.status === 'submit_failed') && (
        <FailureCard failure={state.failure} onRetry={onRetry} onEdit={onEdit} />
      )}
    </article>
  )
}

const PRIMARY = `${PRIMARY_ACTION} ${SMALL}`
const SECONDARY = `${SECONDARY_ACTION} ${SMALL}`

/**
 * In place of the narration, a note pinned on the sheet: what went wrong, in
 * the player's language, and the two ways on. The one more likely to work
 * comes first, filled.
 */
function FailureCard({
  failure,
  onRetry,
  onEdit,
}: {
  failure: Failure
  onRetry: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation('game')
  const editFirst = emphasisOf(failure.code) === 'edit'

  const retry = (
    <button type="button" onClick={onRetry} className={editFirst ? SECONDARY : PRIMARY}>
      {t('failure.retry')}
    </button>
  )
  const edit = (
    <button type="button" onClick={onEdit} className={editFirst ? PRIMARY : SECONDARY}>
      {t('failure.edit')}
    </button>
  )

  return (
    <div
      role="alert"
      className={`${CARD} ml-3 flex flex-col gap-3 border-l-4 border-l-hp py-3.5 pr-3.5 pl-4 lg:ml-10 lg:max-w-[560px]`}
    >
      <p className="text-sm leading-normal text-text">{errorMessage(failure)}</p>
      <div className="flex gap-2.5">
        {editFirst ? edit : retry}
        {editFirst ? retry : edit}
      </div>
    </div>
  )
}

/** Italic is reserved for waiting states (front spec, section 8). */
function Waiting({ text }: { text: string }) {
  return (
    <p className="font-serif text-[0.96875rem] leading-relaxed text-subtle italic lg:text-narration">
      {text}
      <span aria-hidden className="ml-2 inline-flex translate-y-[-0.2em] gap-[3px] align-middle">
        {[0, 200, 400].map((delay) => (
          <span
            key={delay}
            className="size-1 animate-pulse rounded-full bg-current"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </p>
  )
}
