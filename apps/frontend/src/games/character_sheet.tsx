import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { HitPointGauge } from './hit_point_gauge'
import { groupSkills, showsQuantity } from './presentation'
import type { Character, Game } from './queries'

const TABS = ['character', 'inventory', 'quests'] as const

type Tab = (typeof TABS)[number]

/**
 * The player's sheet, read-only: their values are shown as they are, as at
 * the table. The name and the hit points stay in view; the rest is split in
 * three tabs: the character, what they carry, and the quests under way. The
 * place and the period of the day are not here: the scene bar keeps them in
 * view.
 */
export function CharacterSheet({
  game,
  headingId,
  initialTab = 'character',
}: {
  game: Game
  headingId?: string
  initialTab?: Tab
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
    <div className="flex flex-col gap-8">
      <div>
        <h2
          id={headingId}
          className="font-serif text-[1.75rem] leading-tight font-medium text-text"
        >
          {character.name}
        </h2>
        <p className="mt-1 text-label text-muted">{game.world.label}</p>
      </div>

      <section>
        <div className="flex items-baseline justify-between text-label">
          <h3 className="text-muted">{t('sheet.hitPoints')}</h3>
          <span className="text-text">
            {t('hitPoints.value', {
              ns: 'common',
              current: character.hitPoints,
              max: character.hitPointsMax,
            })}
          </span>
        </div>
        <HitPointGauge
          current={character.hitPoints}
          max={character.hitPointsMax}
          className="mt-2"
        />
      </section>

      <div
        role="tablist"
        aria-label={t('sheet.tabs.label')}
        className="flex gap-6 border-b border-border"
      >
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
            className={`-mb-px border-b-2 pb-2 text-label transition-colors ${
              tab === name
                ? 'border-accent text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t(`sheet.tabs.${name}`)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${ids}-${tab}`}
        aria-labelledby={`${ids}-${tab}-tab`}
        className="-mt-2 flex flex-col gap-8"
      >
        {tab === 'character' && <CharacterTab character={character} />}
        {tab === 'inventory' && <InventoryTab inventory={character.inventory} />}
        {tab === 'quests' && <QuestsTab quests={game.activeQuests} />}
      </div>
    </div>
  )
}

/** What they carry, as the backend labels it: no value, no description of the narrator's. */
function InventoryTab({ inventory }: { inventory: Character['inventory'] }) {
  const { t } = useTranslation('game')

  if (inventory.length === 0) {
    return <p className="text-body text-muted">{t('sheet.inventory.empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {inventory.map((entry, index) => (
        <li
          key={entry.handle ?? `${entry.item.reference}-${index}`}
          className="flex items-baseline justify-between gap-4 text-body text-text"
        >
          <span>
            {entry.item.label}
            {showsQuantity(entry) && (
              <span className="ml-2 text-label text-muted tabular-nums">
                {t('sheet.inventory.quantity', { count: entry.quantity })}
              </span>
            )}
          </span>
          {entry.equipped && (
            <span className="shrink-0 rounded-sm border border-accent/50 px-2 py-0.5 text-meta text-accent uppercase">
              {t('sheet.inventory.equipped')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Who they are: the seven characteristics, the skills they trained, their resources. */
function CharacterTab({ character }: { character: Character }) {
  const { t } = useTranslation('game')

  return (
    <>
      <Section title={t('sheet.characteristics')}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {character.characteristics.map((characteristic) => (
            <Row
              key={characteristic.reference}
              label={t(`characteristic.${characteristic.reference}`, { ns: 'enums' })}
              value={characteristic.value}
              className="text-body text-text"
            />
          ))}
        </dl>
      </Section>

      <Section title={t('sheet.skills')}>
        <div className="flex flex-col gap-5">
          {groupSkills(character).map((group) => (
            <div key={group.category}>
              <h4 className="text-label text-subtle">
                {t(`skillCategory.${group.category}`, { ns: 'enums' })}
              </h4>
              <dl className="mt-1.5 ml-1 flex flex-col gap-1 border-l border-border-strong pl-4">
                {group.skills.map((skill) => (
                  <div
                    key={skill.reference}
                    className="flex items-baseline justify-between gap-4 text-label text-muted"
                  >
                    <dt>{skill.label}</dt>
                    <dd className="tabular-nums">{t('sheet.percent', { value: skill.value })}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {character.resources.length > 0 && (
        <Section title={t('sheet.resources')}>
          <dl className="flex flex-col gap-1.5">
            {character.resources.map((resource) => (
              <Row
                key={resource.reference}
                label={resource.label}
                value={resource.value}
                className="text-body text-text"
              />
            ))}
          </dl>
        </Section>
      )}
    </>
  )
}

/** The quests under way, each with the summary the backend keeps of it. */
function QuestsTab({ quests }: { quests: Game['activeQuests'] }) {
  const { t } = useTranslation('game')

  if (quests.length === 0) {
    return <p className="text-body text-muted">{t('sheet.quests.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      {quests.map((quest) => (
        <div key={quest.reference}>
          <h3 className="text-body text-text">{quest.label}</h3>
          {quest.summary && (
            <p className="mt-1.5 font-serif text-body text-muted">{quest.summary}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h3 className="mb-4 text-meta text-subtle uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value, className }: { label: string; value: number; className: string }) {
  const { t } = useTranslation()

  return (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{t('number', { value })}</dd>
    </div>
  )
}
