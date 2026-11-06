import { useState, type DragEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CHARACTERISTICS, type Characteristic } from '@/api/enums'
import { LABEL } from '@/components/surfaces'
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
    <>
      <p className="font-serif text-[0.9375rem] leading-relaxed text-muted">
        {t('creation.placement.intro')}
      </p>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-3">
          <h3 className={LABEL}>{t('creation.placement.results')}</h3>
          {/* The results as tokens to pick up: those already placed are faded. */}
          <ul className="flex flex-wrap gap-2.5">
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
                    className={`block cursor-grab transition-opacity active:cursor-grabbing ${
                      holder ? 'opacity-35' : ''
                    }`}
                  >
                    <Token value={value} used={holder !== undefined} />
                  </span>
                </li>
              )
            })}
          </ul>

          <p className="text-label text-subtle">{t('creation.placement.floor', { floor })}</p>

          {sheet?.hitPoints !== null && sheet?.hitPoints !== undefined && (
            <dl>
              <div className="flex items-baseline gap-1.5 text-[0.90625rem] leading-[1.9] font-semibold text-text">
                <dt>{t('creation.identity.hitPoints')}</dt>
                <span
                  aria-hidden
                  className="flex-1 -translate-y-1 border-b-[1.5px] border-dotted border-leader"
                />
                <dd className="tabular-nums">
                  {t('number', { ns: 'common', value: sheet.hitPoints })}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <ul className="grid gap-2 lg:grid-cols-2">
          {CHARACTERISTICS.map((characteristic) => {
            const index = placement[characteristic]
            const score = sheet?.characteristics[characteristic] ?? null
            const raised = sheet?.raised.includes(characteristic) ?? false
            const label = t(`characteristic.${characteristic}`, { ns: 'enums' })
            const fieldId = `placement-${characteristic}`
            // The preview's score; the result just placed while the preview catches up.
            const shown = score ?? (index === undefined ? null : (roll.values[index] ?? null))

            return (
              <li
                key={characteristic}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOver(characteristic)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={drop(characteristic)}
                className={`flex flex-col gap-1.5 rounded-md border py-2 pr-2.5 pl-3.5 transition-colors ${
                  over === characteristic
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-paper'
                }`}
              >
                <div className="flex items-center gap-3">
                  <label htmlFor={fieldId} className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.90625rem] leading-snug font-semibold text-text">
                      {label}
                    </span>
                    <span
                      aria-hidden
                      className="text-[0.65625rem] leading-tight font-semibold tracking-[0.08em] text-subtle"
                    >
                      {t(`characteristicShort.${characteristic}`, { ns: 'enums' })}
                    </span>
                  </label>
                  {/*
                   * The socket the token sits in. The list of results lies over it, unseen:
                   * picking there is the keyboard's way, and the touch screen's.
                   */}
                  <span className="relative grid size-[50px] shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-leader bg-tray shadow-tray has-focus-visible:ring-2 has-focus-visible:ring-accent">
                    <select
                      id={fieldId}
                      value={index === undefined ? '' : String(index)}
                      onChange={(event) =>
                        event.target.value === ''
                          ? onUnplace(characteristic)
                          : onPlace(characteristic, Number(event.target.value))
                      }
                      className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-full opacity-0"
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
                    {shown === null ? (
                      <>
                        <span className="sr-only">
                          {t('creation.placement.score', { characteristic: label })}{' '}
                          {t('creation.unknown')}
                        </span>
                        <ChevronDown aria-hidden className="size-4 text-subtle" />
                      </>
                    ) : (
                      <Token
                        value={shown}
                        small
                        hidden={t('creation.placement.score', { characteristic: label })}
                      />
                    )}
                  </span>
                </div>
                {raised && (
                  <p className="text-xs text-subtle">{t('creation.placement.raised', { floor })}</p>
                )}
                <Issues issues={issuesOn(issues, `placement.${characteristic}`)} />
              </li>
            )
          })}
        </ul>
      </div>

      <Issues issues={placementIssues} />
    </>
  )
}

/**
 * A result as a round token lying on the table: card fill, a brick ring
 * inside its edge. `used` once placed; `hidden`, words read before the value.
 */
function Token({
  value,
  used = false,
  small = false,
  hidden,
}: {
  value: number
  used?: boolean
  small?: boolean
  hidden?: string
}) {
  const { t } = useTranslation()

  return (
    <span
      className={`grid shrink-0 rounded-full border border-border-strong bg-card p-1 shadow-card ${
        small ? 'size-11' : 'size-[46px]'
      }`}
    >
      <span
        className={`grid place-items-center rounded-full border-[1.5px] text-[1.0625rem] leading-none font-semibold text-text tabular-nums ${
          used ? 'border-leader' : 'border-hp'
        }`}
      >
        {hidden && <span className="sr-only">{hidden}</span>}
        {t('number', { value })}
      </span>
    </span>
  )
}
