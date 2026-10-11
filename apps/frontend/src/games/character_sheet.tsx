import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { HitPointGauge } from './hit_point_gauge'
import { groupSkills, showsQuantity } from './presentation'
import type { Character, Game } from './queries'

const TABS = ['character', 'inventory', 'situation'] as const

type Tab = (typeof TABS)[number]

/**
 * The player's sheet, read-only: their values are shown as they are, as at
 * the table. The name and the hit points stay in view; the rest is split in
 * three tabs: the character, what they carry, and where the story stands.
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
    situation: null,
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
        {tab === 'situation' && <SituationTab game={game} />}
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

/** Who they are: attributes, skills and resources. */
function CharacterTab({ character }: { character: Character }) {
  const { t } = useTranslation('game')

  return (
    <>
      <Section title={t('sheet.attributesAndSkills')}>
        <dl className="flex flex-col gap-5">
          {groupSkills(character).map((attribute) => (
            <div key={attribute.reference}>
              <Row
                label={attribute.label}
                value={attribute.value}
                className="text-body text-text"
              />
              {attribute.skills.length > 0 && (
                <div className="mt-1.5 ml-1 flex flex-col gap-1 border-l border-border-strong pl-4">
                  {attribute.skills.map((skill) => (
                    <Row
                      key={skill.reference}
                      label={skill.label}
                      value={skill.value}
                      className="text-label text-muted"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </dl>
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

/** Where the story stands: the place and the quests under way. */
function SituationTab({ game }: { game: Game }) {
  const { t } = useTranslation('game')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-label text-subtle">{t('sheet.location')}</h3>
        <p className="mt-1 flex items-center gap-2 text-body text-text">
          <MapPin aria-hidden className="size-4 shrink-0 text-muted" />
          {game.location?.label ?? t('sheet.noLocation')}
        </p>
      </div>
      {game.activeQuests.map((quest) => (
        <div key={quest.reference}>
          <h3 className="text-label text-subtle">{t('sheet.quest')}</h3>
          <p className="mt-1 text-body text-text">{quest.label}</p>
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
