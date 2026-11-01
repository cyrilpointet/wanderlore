import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/i18n/errors'
import { useAnimates } from '@/preferences'
import { Narration, PlayerAction, RollChip } from './journal'
import { RollCard } from './roll_card'
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
 * A roll received live is played out on its card, the narration kept back
 * until the dice are thrown (front spec, section 5.3.7).
 */
export function TurnInFlight({
  state,
  reveal,
  onThrow,
  onDiceStopped,
  onFolded,
  onRetry,
  onEdit,
}: {
  state: Exclude<TurnState, { status: 'idle' }>
  reveal: RevealState
  onThrow: () => void
  onDiceStopped: () => void
  onFolded: () => void
  onRetry: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation('game')
  const fadeIn = useAnimates('narration')
  const liveRoll = liveRollOf(reveal, state.submission.turnId)

  return (
    <article className="flex flex-col gap-6">
      <div>
        <PlayerAction text={state.submission.playerInput} />
        {state.status === 'submitting' && (
          <p className="mt-2 pl-4.5 text-meta text-subtle">{t('journal.sending')}</p>
        )}
      </div>

      {liveRoll ? (
        <RollCard
          live={liveRoll}
          onThrow={onThrow}
          onDiceStopped={onDiceStopped}
          onFolded={onFolded}
        />
      ) : (
        (state.status === 'in_progress' || state.status === 'failed') &&
        state.roll && <RollChip roll={state.roll} />
      )}

      {state.status === 'in_progress' &&
        !liveRoll &&
        (state.narration ? (
          <Narration text={state.narration} provisional fadeIn={fadeIn} />
        ) : (
          <Waiting text={waitingText(state, t)} />
        ))}

      {(state.status === 'failed' || state.status === 'submit_failed') && (
        <FailureCard failure={state.failure} onRetry={onRetry} onEdit={onEdit} />
      )}
    </article>
  )
}

const PRIMARY =
  'h-9 rounded-lg bg-accent px-4 text-label font-medium text-on-accent transition-colors hover:bg-accent-hover'
const SECONDARY =
  'h-9 rounded-lg border border-border-strong px-4 text-label font-medium text-text transition-colors hover:border-accent'

/**
 * In place of the narration: what went wrong, in the player's language, and
 * the two ways on. The one more likely to work comes first, filled.
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
    <div role="alert" className="border-l-2 border-danger py-1 pl-4">
      <p className="text-body text-text">{errorMessage(failure)}</p>
      <div className="mt-4 flex gap-3">
        {editFirst ? edit : retry}
        {editFirst ? retry : edit}
      </div>
    </div>
  )
}

/** Italic is reserved for waiting states (front spec, section 8). */
function Waiting({ text }: { text: string }) {
  return (
    <p className="font-serif text-narration text-muted italic lg:text-narration-lg">
      {text}
      <span aria-hidden className="ml-2 inline-flex translate-y-[-0.2em] gap-1 align-middle">
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
