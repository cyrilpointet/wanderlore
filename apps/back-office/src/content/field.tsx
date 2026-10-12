import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

/** A labelled field, with the error the backend gave for it, if any. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-label text-subtle">{hint}</p>}
      {error && <FieldError message={error} />}
    </div>
  )
}

export function FieldError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-label text-danger">
      <CircleAlert aria-hidden className="size-4 shrink-0" />
      {message}
    </p>
  )
}

/** What failed and is not one field's fault, above a form or a section. */
export function FormAlert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-danger/60 p-4 text-body text-text"
    >
      <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
      {message}
    </p>
  )
}
