import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Field, FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { DANGER, INPUT, PRIMARY, SECONDARY, SECTION, TEXTAREA } from '@/content/ui'
import {
  type ActionType,
  actionTypesQuery,
  createActionType,
  deleteActionType,
  updateActionType,
} from './queries'

/**
 * The categories arbitration picks an action from, each tied to the skill
 * that resolves it. Edited one by one: each row saves on its own.
 */
export function ActionTypesEditor({
  worldId,
  actionTypes,
  skills,
}: {
  worldId: string
  actionTypes: ActionType[]
  /** References of the world's saved skills. */
  skills: string[]
}) {
  const { t } = useTranslation('worlds')
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {actionTypes.length === 0 && !adding && (
        <p className="text-body text-muted">{t('actionTypes.empty')}</p>
      )}
      {actionTypes.map((actionType) => (
        <ActionTypeRow key={actionType.id} worldId={worldId} actionType={actionType} skills={skills} />
      ))}
      {adding ? (
        <ActionTypeRow worldId={worldId} skills={skills} onDone={() => setAdding(false)} />
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY}>
            <Plus aria-hidden className="size-4" />
            {t('actionTypes.add')}
          </button>
        </div>
      )}
    </div>
  )
}

function ActionTypeRow({
  worldId,
  actionType,
  skills,
  onDone,
}: {
  worldId: string
  /** Absent for a category being added. */
  actionType?: ActionType
  skills: string[]
  onDone?: () => void
}) {
  const { t } = useTranslation('worlds')
  const queryClient = useQueryClient()
  const [reference, setReference] = useState(actionType?.actionType ?? '')
  const [description, setDescription] = useState(actionType?.description ?? '')
  const [skill, setSkill] = useState(actionType?.associatedSkill ?? skills[0] ?? '')
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const prefix = actionType?.id ?? 'new-action-type'

  const refresh = () => queryClient.invalidateQueries({ queryKey: actionTypesQuery(worldId).queryKey })

  const save = useMutation({
    mutationFn: () =>
      actionType
        ? updateActionType(actionType.id, { description, associatedSkill: skill })
        : createActionType(worldId, { actionType: reference, description, associatedSkill: skill }),
    onMutate: () => setFailure(null),
    onSuccess: async () => {
      await refresh()
      onDone?.()
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  const remove = useMutation({
    mutationFn: () => deleteActionType(actionType!.id),
    onMutate: () => setFailure(null),
    onSuccess: refresh,
    onError: (error) => setFailure(formFailureOf(error)),
  })

  const errors = failure?.fields ?? {}

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
      className={`${SECTION} flex flex-col gap-3`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${prefix}-reference`}
          label={t('actionTypes.reference')}
          error={errors.actionType ?? errors.reference}
        >
          <input
            id={`${prefix}-reference`}
            value={reference}
            disabled={actionType !== undefined}
            onChange={(event) => setReference(event.target.value)}
            className={`${INPUT} font-mono`}
          />
        </Field>
        <Field id={`${prefix}-skill`} label={t('actionTypes.skill')} error={errors.associatedSkill}>
          <select
            id={`${prefix}-skill`}
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
            className={INPUT}
          >
            {!skills.includes(skill) && <option value={skill}>{skill || '—'}</option>}
            {skills.map((reference) => (
              <option key={reference} value={reference}>
                {reference}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        id={`${prefix}-description`}
        label={t('actionTypes.description')}
        hint={t('actionTypes.descriptionHint')}
        error={errors.description}
      >
        <textarea
          id={`${prefix}-description`}
          value={description}
          rows={2}
          onChange={(event) => setDescription(event.target.value)}
          className={TEXTAREA}
        />
      </Field>
      {failure?.general && <FormAlert message={failure.general} />}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={save.isPending} className={PRIMARY}>
          {save.isPending ? t('saving', { ns: 'content' }) : t('save', { ns: 'content' })}
        </button>
        {actionType ? (
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className={DANGER}
          >
            <Trash2 aria-hidden className="size-4" />
            {remove.isPending ? t('deleting', { ns: 'content' }) : t('delete', { ns: 'content' })}
          </button>
        ) : (
          <button type="button" onClick={onDone} className={SECONDARY}>
            {t('cancel', { ns: 'content' })}
          </button>
        )}
      </div>
    </form>
  )
}
