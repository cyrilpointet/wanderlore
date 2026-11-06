import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Info, X } from 'lucide-react'
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
import { ICON_BUTTON } from './actions'
import { LABEL } from './surfaces'

const THEMES: ThemeChoice[] = ['light', 'dark', 'system']

/**
 * The preferences in a native modal `<dialog>`, which brings focus trapping,
 * Escape and an inert page behind it. A card rising from the bottom of a
 * phone, centred over the dimmed table from `lg` (front spec, section 8).
 * Every change applies at once: there is nothing to save.
 */
export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const current = usePreferences()
  const reducedBySystem = useSystemReducesMotion()
  // Rising on a phone, lifted from `lg` — and put back down the same way.
  const moves = animates(current, 'transitions', reducedBySystem)

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
      className={`fixed inset-0 mx-0 mt-auto mb-0 h-fit max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[14px] border border-b-0 border-border-strong bg-card p-0 text-text shadow-lift backdrop:bg-dim lg:m-auto lg:w-[480px] lg:max-w-[calc(100%-2rem)] lg:rounded-md lg:border-b ${moves ? 'dialog-rise lg-lift' : ''}`}
    >
      <div className="flex flex-col gap-[18px] px-[22px] pt-[22px] pb-[max(20px,env(safe-area-inset-bottom))]">
        <PreferencesHeader headingId={headingId} onClose={onClose} />
        <PreferencesPanel
          preferences={current}
          reducedBySystem={reducedBySystem}
          voiceSupported={voiceSupported}
        />
      </div>
    </dialog>
  )
}

/** The title, where the choices are kept, and the way out. */
export function PreferencesHeader({
  headingId,
  onClose,
}: {
  headingId: string
  onClose: () => void
}) {
  const { t } = useTranslation('preferences')

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 id={headingId} className="font-serif text-xl leading-tight font-semibold text-text">
          {t('title')}
        </h2>
        <p className="mt-1 text-label text-subtle">{t('deviceNote')}</p>
      </div>
      <button type="button" onClick={onClose} aria-label={t('close')} className={ICON_BUTTON}>
        <X aria-hidden className="size-[18px]" />
      </button>
    </div>
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
    <div className="flex flex-col gap-[18px]">
      <Group heading={t('appearance.heading')}>
        <fieldset className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2">
          <legend className="float-left text-[0.90625rem] font-medium text-text">
            {t('appearance.theme')}
          </legend>
          {/* A segmented control sunk in the table, the chosen segment a card on it. */}
          <div className="ml-auto inline-flex gap-0.5 rounded-lg bg-tray p-[3px] shadow-tray">
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
                <span className="block cursor-pointer rounded-md px-3.5 py-2 text-[0.84375rem] leading-none font-medium text-muted transition-colors peer-checked:bg-card peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-text">
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
          <p className="flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2.5 text-label text-text">
            <Info aria-hidden className="mt-px size-4 shrink-0" />
            {t('animations.reducedBySystem')}
          </p>
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
    <section className="flex flex-col gap-2.5 border-t border-border pt-4">
      <h3 className={LABEL}>{heading}</h3>
      {children}
    </section>
  )
}

/** An on/off setting: a `switch`, its state read out with its label. Ink blue when on. */
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
    <div className={`flex justify-between gap-3.5 ${hint ? 'items-start' : 'items-center'}`}>
      <div>
        <p
          id={`${id}-label`}
          className={`text-[0.90625rem] leading-snug font-medium ${disabled ? 'text-subtle' : 'text-text'}`}
        >
          {label}
        </p>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-[0.78125rem] leading-[1.45] text-subtle">
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
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? 'bg-accent' : 'bg-leader'
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-[3px] left-[3px] size-[18px] rounded-full bg-card shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  )
}
