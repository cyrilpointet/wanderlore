import { useTranslation } from 'react-i18next'

/**
 * The credit the ORC License asks for: the rules are Chaosium's Basic
 * Roleplaying. Shown where every player passes — signing in, their games —
 * rather than in the game screen, where it would sit on the story.
 */
export function RulesCredit() {
  const { t } = useTranslation()

  return <p className="mt-8 text-center text-meta text-subtle">{t('rulesCredit')}</p>
}
