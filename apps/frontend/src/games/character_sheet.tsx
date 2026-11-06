import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IdentityLine } from '@/characters/character_card'
import { ICON_BUTTON } from '@/components/actions'
import { HitPoints } from '@/components/hit_points'
import { Stamp } from '@/components/stamp'
import { CARD, FOLDER_TAB, FOLDER_TAB_ON, INSET, LABEL } from '@/components/surfaces'
import { groupSkills, showsQuantity } from './presentation'
import { SHEET_TABS, type SheetTab } from './sheet_tabs'
import type { Character, Game } from './queries'

const TABS = SHEET_TABS

type Tab = SheetTab

/**
 * The player's sheet, read-only: their values are shown as they are, as at
 * the table. A stack of index cards with tabs (front spec, section 8) — the
 * character, what they carry, the quests under way — the active card on top,
 * the others barely showing underneath. The place and the period of the day
 * are not here: the place tag keeps them in view.
 */
export function CharacterSheet({
  game,
  headingId,
  initialTab = 'character',
  onClose,
}: {
  game: Game
  headingId?: string
  initialTab?: Tab
  /** Where the sheet can be put back down: a close button at the end of the tabs. */
  onClose?: () => void
}) {
  const { t } = useTranslation('game')
  const { character } = game
  const [tab, setTab] = useState<Tab>(initialTab)
  const ids = useId()
  const tabs = useRef<Record<Tab, HTMLButtonElement | null>>({
    character: null,
    inventory: null,
    quests: null,
  })

  /** Arrow keys move to the previous or next tab, wrapping around, as a tab list expects. */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1
    const next = TABS[(TABS.indexOf(tab) + step) % TABS.length] ?? tab
    setTab(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 id={headingId} className="sr-only">
        {character.name}
      </h2>
      <div className="flex items-end gap-1 pl-2.5">
        <div role="tablist" aria-label={t('sheet.tabs.label')} className="flex items-end gap-1">
          {TABS.map((name) => (
            <button
              key={name}
              ref={(element) => {
                tabs.current[name] = element
              }}
              type="button"
              role="tab"
              id={`${ids}-${name}-tab`}
              aria-selected={tab === name}
              aria-controls={`${ids}-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={onKeyDown}
              className={`${FOLDER_TAB} transition-colors hover:text-text ${tab === name ? FOLDER_TAB_ON : ''}`}
            >
              {t(`sheet.tabs.${name}`)}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeSheet')}
            className={`${ICON_BUTTON} mb-1.5 ml-auto`}
          >
            <X aria-hidden className="size-[18px]" />
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          aria-hidden
          className="absolute inset-0 translate-x-1 translate-y-[5px] rotate-[0.7deg] rounded-[4px] border border-border-strong bg-card-under"
        />
        <div
          aria-hidden
          className="absolute inset-0 -translate-x-[3px] translate-y-2 -rotate-[0.5deg] rounded-[4px] border border-border-strong bg-card-under"
        />
        <div
          role="tabpanel"
          id={`${ids}-${tab}`}
          aria-labelledby={`${ids}-${tab}-tab`}
          tabIndex={0}
          className={`${CARD} relative flex h-full flex-col gap-5 overflow-y-auto px-5 pt-[22px] pb-6 [scrollbar-width:thin]`}
        >
          {tab === 'character' && <CharacterTab game={game} />}
          {tab === 'inventory' && <InventoryTab inventory={character.inventory} />}
          {tab === 'quests' && <QuestsTab quests={game.activeQuests} />}
        </div>
      </div>
    </div>
  )
}

/** Who they are: name and trade, hit points, the durable sheet, their resources. */
function CharacterTab({ game }: { game: Game }) {
  const { t } = useTranslation('game')
  const { character } = game

  return (
    <>
      <div>
        <p className="font-serif text-[1.625rem] leading-tight font-semibold text-text">
          {character.name}
        </p>
        <p className="mt-0.5 text-[0.84375rem] text-muted">
          <IdentityLine character={{ ...character, world: game.world }} withGender />
        </p>
      </div>

      <section className={`${INSET} flex flex-col gap-2.5 px-3.5 py-3`}>
        <div className="flex items-center justify-between">
          <h3 className={LABEL}>{t('sheet.hitPoints')}</h3>
          <span aria-hidden className="text-[0.8125rem] font-semibold text-hp tabular-nums">
            {t('hitPoints.value', {
              ns: 'common',
              current: character.hitPoints,
              max: character.hitPointsMax,
            })}
          </span>
        </div>
        <HitPoints
          current={character.hitPoints}
          max={character.hitPointsMax}
          size="large"
          value={false}
        />
      </section>

      <CharacterStats character={character} />
      <Resources resources={character.resources} />
    </>
  )
}

/** What they carry, as the backend labels it: no value, no description of the narrator's. */
function InventoryTab({ inventory }: { inventory: Character['inventory'] }) {
  const { t } = useTranslation('game')

  return (
    <>
      <h3 className="font-serif text-[1.625rem] leading-tight font-semibold text-text">
        {t('sheet.tabs.inventory')}
      </h3>
      {inventory.length === 0 ? (
        <p className="text-body text-muted">{t('sheet.inventory.empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {inventory.map((entry, index) => (
            <li
              key={entry.handle ?? `${entry.item.reference}-${index}`}
              className="flex items-center justify-between gap-2.5 border-b border-border py-[11px] text-body font-medium text-text first:pt-0"
            >
              <span>{entry.item.label}</span>
              <span className="flex shrink-0 items-center gap-2.5">
                {entry.equipped && <Stamp tone="neutral">{t('sheet.inventory.equipped')}</Stamp>}
                {showsQuantity(entry) && (
                  <span className="text-muted tabular-nums">
                    {t('sheet.inventory.quantity', { count: entry.quantity })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Resources({ resources }: { resources: Character['resources'] }) {
  const { t } = useTranslation('game')
  if (resources.length === 0) return null

  return (
    <Section title={t('sheet.resources')}>
      <dl>
        {resources.map((resource) => (
          <Leader
            key={resource.reference}
            label={resource.label}
            value={t('number', { ns: 'common', value: resource.value })}
          />
        ))}
      </dl>
    </Section>
  )
}

/**
 * The durable sheet: the seven characteristics, the skills trained under
 * their category. The same in a game, on the character's page and at the end
 * of a creation.
 */
export function CharacterStats({
  character,
}: {
  character: Pick<Character, 'characteristics' | 'skills'>
}) {
  const { t } = useTranslation('game')

  return (
    <>
      <Section title={t('sheet.characteristics')}>
        <dl className="grid grid-cols-7 gap-[5px]">
          {character.characteristics.map((characteristic) => (
            <div
              key={characteristic.reference}
              className={`${INSET} flex flex-col items-center gap-0.5 pt-[7px] pb-1.5`}
            >
              <dt className="text-[0.59375rem] leading-none font-semibold tracking-[0.06em] text-subtle">
                <abbr
                  title={t(`characteristic.${characteristic.reference}`, { ns: 'enums' })}
                  className="no-underline"
                >
                  {t(`characteristicShort.${characteristic.reference}`, { ns: 'enums' })}
                </abbr>
              </dt>
              <dd className="text-[1.0625rem] leading-tight font-semibold text-text tabular-nums">
                {t('number', { ns: 'common', value: characteristic.value })}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t('sheet.skills')}>
        <div className="flex flex-col gap-3">
          {groupSkills(character).map((group) => (
            <div key={group.category}>
              <h4 className="mb-1 text-[0.71875rem] font-semibold text-muted">
                {t(`skillCategory.${group.category}`, { ns: 'enums' })}
              </h4>
              <dl>
                {group.skills.map((skill) => (
                  <Leader
                    key={skill.reference}
                    label={skill.label}
                    value={t('sheet.percent', { value: skill.value })}
                  />
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

/** The quests under way, each with the summary the backend keeps of it. */
function QuestsTab({ quests }: { quests: Game['activeQuests'] }) {
  const { t } = useTranslation('game')

  return (
    <>
      <h3 className="font-serif text-[1.625rem] leading-tight font-semibold text-text">
        {t('sheet.tabs.quests')}
      </h3>
      {quests.length === 0 ? (
        <p className="text-body text-muted">{t('sheet.quests.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {quests.map((quest) => (
            <div key={quest.reference} className="flex flex-col gap-1.5">
              <h4 className="font-serif text-lg leading-snug font-semibold text-text">
                {quest.label}
              </h4>
              {quest.summary && (
                <p className="font-serif text-[0.9375rem] leading-relaxed text-muted">
                  {quest.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className={LABEL}>{title}</h3>
      {children}
    </section>
  )
}

/** A name, a dotted leader, a value: a line of a printed sheet. */
function Leader({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[0.90625rem] leading-[1.9] text-text">
      <dt>{label}</dt>
      <span
        aria-hidden
        className="flex-1 -translate-y-1 border-b-[1.5px] border-dotted border-leader"
      />
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
