import { useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { CHARACTERISTICS, type Characteristic } from '@/api/enums'
import type { CharacteristicRoll, CreationIssue, PreviewSheet } from '../queries'
import { issuesOn } from './draft'
import { Issues } from './issues'

/** What a dragged result carries: its position in the series. */
const DRAG_TYPE = 'application/x-wanderlore-result'

/**
 * Each result of the series on a characteristic, each once (front spec,
 * section 5.6): dragged from the row of results, or picked in the list of a
 * characteristic — the keyboard's way. The score shown is the preview's, SIZ
 * and INT raised by the backend when a lower result lands there.
 */
export function PlacementStep({
  roll,
  placement,
  floor,
  sheet,
  issues,
  onPlace,
  onUnplace,
}: {
  roll: CharacteristicRoll
  placement: Partial<Record<Characteristic, number>>
  /** The floor of SIZ and INT, as the backend sets it. */
  floor: number
  sheet: PreviewSheet | null
  /** The step's issues worth showing. */
  issues: CreationIssue[]
  onPlace: (characteristic: Characteristic, index: number) => void
  onUnplace: (characteristic: Characteristic) => void
}) {
  const { t } = useTranslation('characters')
  const [over, setOver] = useState<Characteristic | null>(null)
  const placementIssues = issuesOn(issues, 'placement')
  const holderOf = (index: number) => CHARACTERISTICS.find((name) => placement[name] === index)

  const drop = (characteristic: Characteristic) => (event: DragEvent) => {
    event.preventDefault()
    setOver(null)
    const index = Number(event.dataTransfer.getData(DRAG_TYPE))
    if (event.dataTransfer.getData(DRAG_TYPE) !== '' && Number.isInteger(index))
      onPlace(characteristic, index)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">{t('creation.placement.intro')}</p>

      <div>
        <h3 className="mb-2 text-meta text-subtle uppercase">{t('creation.placement.results')}</h3>
        <ul className="flex flex-wrap gap-2">
          {roll.values.map((value, index) => {
            const holder = holderOf(index)
            return (
              <li key={index}>
                <span
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, String(index))
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  className={`grid h-10 min-w-10 cursor-grab place-items-center rounded-lg border px-2 text-body font-medium tabular-nums transition-colors active:cursor-grabbing ${
                    holder
                      ? 'border-border bg-surface-2 text-subtle'
                      : 'border-accent/60 bg-surface-1 text-text'
                  }`}
                >
                  {value}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-label text-subtle">{t('creation.placement.floor', { floor })}</p>

      <ul className="flex flex-col gap-2">
        {CHARACTERISTICS.map((characteristic) => {
          const index = placement[characteristic]
          const score = sheet?.characteristics[characteristic] ?? null
          const raised = sheet?.raised.includes(characteristic) ?? false
          const label = t(`characteristic.${characteristic}`, { ns: 'enums' })
          const fieldId = `placement-${characteristic}`

          return (
            <li
              key={characteristic}
              onDragOver={(event) => {
                event.preventDefault()
                setOver(characteristic)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={drop(characteristic)}
              className={`rounded-lg border p-3 transition-colors ${
                over === characteristic
                  ? 'border-accent bg-accent/10'
                  : 'border-border-strong bg-surface-1'
              }`}
            >
              <div className="flex items-center gap-3">
                <label htmlFor={fieldId} className="min-w-0 flex-1 text-body text-text">
                  {label}
                </label>
                <select
                  id={fieldId}
                  value={index === undefined ? '' : String(index)}
                  onChange={(event) =>
                    event.target.value === ''
                      ? onUnplace(characteristic)
                      : onPlace(characteristic, Number(event.target.value))
                  }
                  className="h-10 w-32 shrink-0 rounded-lg border border-border-strong bg-surface-2 px-2 text-body text-text focus:border-accent focus:outline-none"
                >
                  <option value="">{t('creation.placement.none')}</option>
                  {roll.values.map((value, option) => {
                    const holder = holderOf(option)
                    return (
                      <option key={option} value={String(option)}>
                        {holder && holder !== characteristic
                          ? t('creation.placement.optionTaken', {
                              value,
                              characteristic: t(`characteristic.${holder}`, { ns: 'enums' }),
                            })
                          : t('creation.placement.option', { value })}
                      </option>
                    )
                  })}
                </select>
                <span className="w-10 shrink-0 text-right text-body font-medium text-text tabular-nums">
                  <span className="sr-only">
                    {t('creation.placement.score', { characteristic: label })}
                  </span>
                  {score ?? t('creation.unknown')}
                </span>
              </div>
              {raised && (
                <p className="mt-1.5 text-label text-accent">
                  {t('creation.placement.raised', { floor })}
                </p>
              )}
              <Issues issues={issuesOn(issues, `placement.${characteristic}`)} className="mt-1.5" />
            </li>
          )
        })}
      </ul>

      <Issues issues={placementIssues} />

      {sheet?.hitPoints !== null && sheet?.hitPoints !== undefined && (
        <p className="text-body text-muted">
          {t('creation.hitPoints', { value: sheet.hitPoints })}
        </p>
      )}
    </div>
  )
}
