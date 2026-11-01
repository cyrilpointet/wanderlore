import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { voiceSupported } from '@/games/use_narration_voice'
import {
  ANIMATIONS,
  animates,
  preferences as store,
  usePreferences,
  useSystemReducesMotion,
  type Preferences,
} from '@/preferences'
import type { ThemeChoice } from '@/theme'

const THEMES: ThemeChoice[] = ['system', 'dark', 'light']

/**
 * The preferences in a native modal `<dialog>`, which brings focus trapping,
 * Escape and an inert page behind it. Every change applies at once: there is
 * nothing to save.
 */
export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('preferences')
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const current = usePreferences()
  const reducedBySystem = useSystemReducesMotion()

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, never on its content.
      onClick={(event) => event.target === dialog.current && onClose()}
      className="fixed inset-0 m-auto h-fit max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg border border-border-strong bg-surface-3 p-0 text-text shadow-[0_12px_40px_rgb(0_0_0/0.35)] backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id={headingId} className="font-serif text-xl font-medium text-text">
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="px-5 pb-6">
        <PreferencesPanel
          preferences={current}
          reducedBySystem={reducedBySystem}
          voiceSupported={voiceSupported}
        />
      </div>
    </dialog>
  )
}

/**
 * The settings themselves, from the values handed in: what the screen shows
 * can be read without a browser. A change goes straight to the store.
 */
export function PreferencesPanel({
  preferences,
  reducedBySystem,
  voiceSupported,
}: {
  preferences: Preferences
  /** The system asks for less motion: the animation switches are off and locked. */
  reducedBySystem: boolean
  /** No reading-aloud setting where the browser cannot speak. */
  voiceSupported: boolean
}) {
  const { t } = useTranslation('preferences')
  const themeName = useId()

  return (
    <div className="flex flex-col gap-6">
      <p className="text-label text-muted">{t('deviceNote')}</p>

      <Group heading={t('appearance.heading')}>
        <fieldset className="py-3">
          <legend className="text-body text-text">{t('appearance.theme')}</legend>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border-strong p-1">
            {THEMES.map((theme) => (
              <label key={theme} className="relative">
                <input
                  type="radio"
                  name={themeName}
                  value={theme}
                  checked={preferences.theme === theme}
                  onChange={() => store.setTheme(theme)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-sm px-2 py-1.5 text-center text-label text-muted transition-colors peer-checked:bg-surface-1 peer-checked:font-medium peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-text">
                  {t(`appearance.${theme}`)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Group>

      {voiceSupported && (
        <Group heading={t('narration.heading')}>
          <Switch
            label={t('narration.voice')}
            hint={t('narration.voiceHint')}
            checked={preferences.narrationVoice}
            onChange={(on) => store.setNarrationVoice(on)}
          />
        </Group>
      )}

      <Group heading={t('dice.heading')}>
        <Switch
          label={t('dice.autoRoll')}
          hint={t('dice.autoRollHint')}
          checked={preferences.autoRoll}
          onChange={(on) => store.setAutoRoll(on)}
        />
      </Group>

      <Group heading={t('animations.heading')}>
        {reducedBySystem && (
          <p className="py-3 text-label text-muted">{t('animations.reducedBySystem')}</p>
        )}
        {ANIMATIONS.map((animation) => (
          <Switch
            key={animation}
            label={t(`animations.${animation}`)}
            checked={animates(preferences, animation, reducedBySystem)}
            disabled={reducedBySystem}
            onChange={(on) => store.setAnimation(animation, on)}
          />
        ))}
      </Group>
    </div>
  )
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-meta text-subtle uppercase">{heading}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

/** An on/off setting: a `switch`, its state read out with its label. */
function Switch({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  const id = useId()

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className={disabled ? 'opacity-60' : undefined}>
        <p id={`${id}-label`} className="text-body text-text">
          {label}
        </p>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-label text-muted">
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? 'border-accent bg-accent' : 'border-border-strong bg-surface-2'
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 size-4.5 rounded-sm transition-transform ${
            checked ? 'translate-x-4 bg-on-accent' : 'bg-muted'
          }`}
        />
      </button>
    </div>
  )
}
