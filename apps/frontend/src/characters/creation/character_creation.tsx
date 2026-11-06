import { useReducer, type Dispatch } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiError, NetworkError } from '@/api/client'
import { PRIMARY_ACTION, SECONDARY_ACTION } from '@/components/actions'
import { SHEET } from '@/components/surfaces'
import { errorMessage, failureMessage } from '@/i18n/errors'
import { useAnimates } from '@/preferences'
import {
  CHARACTERS_KEY,
  createCharacter,
  rollCharacteristics,
  type CreationWorld,
  type Preview,
} from '../queries'
import { DiceStep } from './dice_step'
import {
  draftBody,
  draftReducer,
  initialDraft,
  issuesOf,
  shownIssues,
  type Draft,
  type DraftAction,
} from './draft'
import { IdentityStep } from './identity_step'
import { PlacementStep } from './placement_step'
import { ProfessionStep } from './profession_step'
import { SkillsStep } from './skills_step'
import { usePreview } from './use_preview'

/**
 * Creating a character, step by step (front spec, section 5.6). The draft
 * lives here, and goes when the page does; every figure shown comes from the
 * preview. **Create** sends it once; a refusal leads back to the step of the
 * field at fault.
 */
export function CharacterCreation({ creation }: { creation: CreationWorld }) {
  const { t } = useTranslation('characters')
  const worldId = creation.world.id
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => initialDraft())
  const preview = usePreview(worldId, draft)
  const animated = useAnimates('dice')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const roll = useMutation({
    mutationFn: rollCharacteristics,
    onSuccess: (series) => dispatch({ type: 'rolled', roll: series }),
  })

  const create = useMutation({
    mutationFn: () => {
      if (!draft.roll) throw new Error('No series to create the character from.')
      return createCharacter({ ...draftBody(worldId, draft), rollId: draft.roll.id })
    },
    onSuccess: async (characterId) => {
      await queryClient.invalidateQueries({ queryKey: CHARACTERS_KEY })
      await navigate({ to: '/characters/$characterId', params: { characterId } })
    },
    onError: (error) => dispatch(refusalOf(error)),
  })

  const index = draft.steps.findIndex(({ id }) => id === draft.step)
  const last = index === draft.steps.length - 1
  const stepIssues = preview.preview
    ? issuesOf(draft.steps, draft.step, preview.preview.issues)
    : []
  /** The step holds together, on a preview of the draft as it stands. */
  const canGoOn = draft.roll !== null && preview.current && stepIssues.length === 0

  const reachedIndex = draft.steps.findIndex(({ id }) => id === draft.reached)

  return (
    <div>
      {/* Card dividers sitting on top of the step's sheet: done ones checked, the current one raised. */}
      <nav aria-label={t('creation.steps.label')}>
        <ol className="flex items-end gap-1">
          {draft.steps.map((step, position) => {
            const reachable = position <= reachedIndex
            const current = step.id === draft.step
            const done = position < index
            return (
              <li
                key={step.id}
                className={`flex min-w-0 ${current ? 'relative z-10 -mb-px flex-none lg:flex-1' : 'flex-1'}`}
              >
                <button
                  type="button"
                  disabled={!reachable || current || create.isPending}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => dispatch({ type: 'went', step: step.id })}
                  className={`${STEP_TAB} ${
                    current
                      ? 'bg-card px-3 pt-3 text-text'
                      : `bg-card-under px-1 pt-2 ${
                          done
                            ? 'text-success'
                            : reachable
                              ? 'text-muted hover:text-text'
                              : 'text-subtle'
                        }`
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] text-[0.625rem] tracking-normal ${
                      current
                        ? 'border-accent bg-accent text-on-accent'
                        : done
                          ? 'border-success bg-success text-on-accent'
                          : 'border-current'
                    }`}
                  >
                    {done ? (
                      <Check strokeWidth={3} className="size-[11px]" />
                    ) : (
                      t('creation.steps.number', { value: position + 1 })
                    )}
                  </span>
                  {/* On a phone only the current divider spells its name out. */}
                  <span className={`truncate ${current ? '' : 'sr-only lg:not-sr-only'}`}>
                    {t(`creation.steps.${step.id}`)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <section
        aria-labelledby="creation-step-heading"
        className={`${SHEET} flex flex-col gap-5 rounded-t-none! px-4 pt-5 pb-[22px] lg:px-8 lg:pt-7 lg:pb-[30px]`}
      >
        <h2 id="creation-step-heading" className="sr-only">
          {t(`creation.steps.${draft.step}`)}
        </h2>

        {draft.refusal && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/60 bg-danger-soft p-3.5 text-body text-text"
          >
            <CircleAlert aria-hidden className="mt-1 size-4 shrink-0 text-danger" />
            {errorMessage(draft.refusal)}
          </p>
        )}

        {preview.error && (
          <div
            role="alert"
            className="rounded-md border border-danger/60 bg-danger-soft p-3.5 text-body text-text"
          >
            <p className="flex items-center gap-2">
              <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
              {failureMessage(preview.error)}
            </p>
            <button
              type="button"
              onClick={preview.retry}
              disabled={preview.retrying}
              className={`mt-3 ${SECONDARY_ACTION}`}
            >
              {t('tryAgain', { ns: 'common' })}
            </button>
          </div>
        )}

        <StepContent
          draft={draft}
          dispatch={dispatch}
          creation={creation}
          preview={preview.preview}
          issues={shownIssues(stepIssues)}
          rolling={roll.isPending}
          rollError={roll.isError ? failureMessage(roll.error) : null}
          onRoll={() => roll.mutate()}
          animated={animated}
        />

        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => dispatch({ type: 'back' })}
            disabled={index === 0 || create.isPending}
            className={SECONDARY_ACTION}
          >
            {t('creation.back')}
          </button>
          {last ? (
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={!canGoOn || create.isPending}
              aria-busy={create.isPending}
              className={PRIMARY_ACTION}
            >
              {create.isPending ? t('creation.creating') : t('creation.create')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: 'next' })}
              disabled={!canGoOn}
              className={PRIMARY_ACTION}
            >
              {t('creation.next')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

/** A step's divider: a folder tab, its number in a ring. */
const STEP_TAB =
  'flex w-full min-w-0 items-center justify-center gap-1.5 rounded-t-[7px] border border-b-0 border-border-strong pb-[9px] text-[0.6875rem] leading-none font-semibold tracking-[0.06em] uppercase transition-colors disabled:cursor-default'

/** The step the player is on, fed by the draft and the preview. */
export function StepContent({
  draft,
  dispatch,
  creation,
  preview,
  issues,
  rolling,
  rollError,
  onRoll,
  animated,
}: {
  draft: Draft
  dispatch: Dispatch<DraftAction>
  creation: CreationWorld
  preview: Preview | null
  /** The step's issues worth showing. */
  issues: Preview['issues']
  rolling: boolean
  rollError: string | null
  onRoll: () => void
  animated: boolean
}) {
  const sheet = preview?.sheet ?? null

  switch (draft.step) {
    case 'dice':
      return (
        <DiceStep
          roll={draft.roll}
          rolling={rolling}
          error={rollError}
          animated={animated}
          onRoll={onRoll}
        />
      )
    case 'placement':
      // Reached only once a series is drawn.
      return draft.roll ? (
        <PlacementStep
          roll={draft.roll}
          placement={draft.placement}
          floor={creation.characteristicFloor}
          sheet={sheet}
          issues={issues}
          onPlace={(characteristic, index) => dispatch({ type: 'placed', characteristic, index })}
          onUnplace={(characteristic) => dispatch({ type: 'unplaced', characteristic })}
        />
      ) : null
    case 'profession':
      return (
        <ProfessionStep
          professions={creation.professions}
          chosen={draft.profession}
          issues={issues}
          onChoose={(profession) => dispatch({ type: 'profession_chosen', profession })}
        />
      )
    case 'skills':
      return (
        <SkillsStep
          creation={creation}
          profession={draft.profession}
          professionalPoints={draft.professionalPoints}
          personalPoints={draft.personalPoints}
          sheet={sheet}
          issues={issues}
          onPoints={(pool, skill, points) => dispatch({ type: 'points_set', pool, skill, points })}
        />
      )
    case 'identity':
      return (
        <IdentityStep
          creation={creation}
          name={draft.name}
          gender={draft.gender}
          profession={draft.profession}
          sheet={sheet}
          issues={issues}
          onName={(name) => dispatch({ type: 'named', name })}
          onGender={(gender) => dispatch({ type: 'gender_chosen', gender })}
        />
      )
  }
}

/** A refused creation, as the draft records it: the field at fault names the step to go back to. */
function refusalOf(error: unknown): DraftAction {
  if (error instanceof ApiError && error.code) {
    return { type: 'refused', code: error.code, message: error.message, field: fieldOf(error.body) }
  }
  if (error instanceof NetworkError) {
    return { type: 'refused', code: error.code, message: error.message }
  }
  return { type: 'refused', code: 'unexpected', message: failureMessage(error) }
}

function fieldOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined
  const { error } = body as { error: unknown }
  if (typeof error !== 'object' || error === null || !('details' in error)) return undefined
  const { details } = error as { details: unknown }
  if (typeof details !== 'object' || details === null || !('field' in details)) return undefined
  const { field } = details as { field: unknown }
  return typeof field === 'string' ? field : undefined
}
