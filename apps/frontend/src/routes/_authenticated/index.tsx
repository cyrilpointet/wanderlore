import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'
import { PAGE } from '@/components/layout'
import { CardSkeletons, LoadError } from '@/components/load_states'
import { RulesCredit } from '@/components/rules_credit'
import { CharacterCard, WorldCard } from '@/characters/character_card'
import { charactersQuery, worldsQuery } from '@/characters/queries'
import { failureMessage } from '@/i18n/errors'

/**
 * The home, once signed in (front spec, section 5.6): the player's
 * characters, then the worlds a new one can be made in.
 */
export const Route = createFileRoute('/_authenticated/')({
  component: Home,
})

function Home() {
  const { t } = useTranslation('characters')

  return (
    <>
      <AppHeader />
      <main className={`${PAGE} flex flex-col gap-[26px] pt-[26px] pb-12 lg:gap-9 lg:pt-9`}>
        <section aria-labelledby="characters-heading" className="flex flex-col gap-3.5">
          <h1
            id="characters-heading"
            className="font-serif text-[1.625rem] leading-tight font-semibold text-balance text-text"
          >
            {t('home.title')}
          </h1>
          <Characters />
        </section>
        <section aria-labelledby="worlds-heading" className="flex flex-col gap-3.5">
          <header className="flex flex-col gap-1">
            <h2
              id="worlds-heading"
              className="font-serif text-xl leading-tight font-semibold text-balance text-text"
            >
              {t('worlds.title')}
            </h2>
            <p className="font-serif text-[0.96875rem] leading-relaxed text-muted italic">
              {t('worlds.intro')}
            </p>
          </header>
          <Worlds />
        </section>
        <RulesCredit />
      </main>
    </>
  )
}

/** Two columns from a wide screen up, as cards lie side by side on the table. */
const GRID = 'grid gap-4 lg:grid-cols-2 lg:gap-[22px]'

function Characters() {
  const { t } = useTranslation('characters')
  const characters = useQuery(charactersQuery)

  if (characters.isPending) return <CardSkeletons label={t('home.loading')} className={GRID} />

  if (characters.isError) {
    return (
      <LoadError
        message={failureMessage(characters.error)}
        retrying={characters.isFetching}
        onRetry={() => void characters.refetch()}
      />
    )
  }

  if (characters.data.length === 0) {
    return (
      <p className="font-serif text-body text-muted italic">
        {t('home.empty')} {t('home.emptyHint')}
      </p>
    )
  }

  return (
    <ul className={GRID}>
      {characters.data.map((character) => (
        <li key={character.id}>
          <CharacterCard character={character} />
        </li>
      ))}
    </ul>
  )
}

function Worlds() {
  const { t } = useTranslation('characters')
  const worlds = useQuery(worldsQuery)

  if (worlds.isPending) {
    return <CardSkeletons label={t('worlds.loading')} count={1} className={GRID} />
  }

  if (worlds.isError) {
    return (
      <LoadError
        message={failureMessage(worlds.error)}
        retrying={worlds.isFetching}
        onRetry={() => void worlds.refetch()}
      />
    )
  }

  if (worlds.data.length === 0) {
    return <p className="font-serif text-body text-muted italic">{t('worlds.empty')}</p>
  }

  return (
    <ul className={GRID}>
      {worlds.data.map((world) => (
        <li key={world.id}>
          <WorldCard world={world} />
        </li>
      ))}
    </ul>
  )
}
