import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'
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
      <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-12 sm:px-6 lg:pt-16">
        <section aria-labelledby="characters-heading">
          <h1
            id="characters-heading"
            className="mb-6 font-serif text-[1.75rem] leading-tight font-medium text-text lg:text-[2rem]"
          >
            {t('home.title')}
          </h1>
          <Characters />
        </section>
        <section aria-labelledby="worlds-heading" className="mt-12">
          <h2
            id="worlds-heading"
            className="mb-2 font-serif text-[1.375rem] leading-tight font-medium text-text"
          >
            {t('worlds.title')}
          </h2>
          <p className="mb-6 text-body text-muted">{t('worlds.intro')}</p>
          <Worlds />
        </section>
        <RulesCredit />
      </main>
    </>
  )
}

function Characters() {
  const { t } = useTranslation('characters')
  const characters = useQuery(charactersQuery)

  if (characters.isPending) return <CardSkeletons label={t('home.loading')} />

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
      <p className="text-body text-muted">
        {t('home.empty')} {t('home.emptyHint')}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
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

  if (worlds.isPending) return <CardSkeletons label={t('worlds.loading')} count={1} />

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
    return <p className="text-body text-muted">{t('worlds.empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-4">
      {worlds.data.map((world) => (
        <li key={world.id}>
          <WorldCard world={world} />
        </li>
      ))}
    </ul>
  )
}
