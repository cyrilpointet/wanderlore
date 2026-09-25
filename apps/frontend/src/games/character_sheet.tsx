import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { HitPointGauge } from './hit_point_gauge'
import { groupSkills } from './presentation'
import type { Game } from './queries'

/**
 * The player's sheet, read-only: their values are shown as they are, as at
 * the table. Built as one panel so Phase 4 can add an inventory tab to it.
 */
export function CharacterSheet({ game, headingId }: { game: Game; headingId?: string }) {
  const { t } = useTranslation('game')
  const { character } = game

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

      <Section title={t('sheet.situation')}>
        <div className="flex flex-col gap-5">
          <div>
            <h4 className="text-label text-subtle">{t('sheet.location')}</h4>
            <p className="mt-1 flex items-center gap-2 text-body text-text">
              <MapPin aria-hidden className="size-4 shrink-0 text-muted" />
              {game.location?.label ?? t('sheet.noLocation')}
            </p>
          </div>
          {game.activeQuests.map((quest) => (
            <div key={quest.reference}>
              <h4 className="text-label text-subtle">{t('sheet.quest')}</h4>
              <p className="mt-1 text-body text-text">{quest.label}</p>
              {quest.summary && (
                <p className="mt-1.5 font-serif text-body text-muted">{quest.summary}</p>
              )}
            </div>
          ))}
        </div>
      </Section>
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
