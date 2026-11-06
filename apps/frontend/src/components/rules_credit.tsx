import { useTranslation } from 'react-i18next'

/**
 * The credit the ORC License asks for: the rules are Chaosium's Basic
 * Roleplaying. Shown where every player passes — signing in, their games —
 * rather than in the game screen, where it would sit on the story. The
 * caller spaces it.
 */
export function RulesCredit({ className = '' }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <p className={`text-center text-[0.71875rem] leading-normal text-subtle ${className}`}>
      {t('rulesCredit')}
    </p>
  )
}
