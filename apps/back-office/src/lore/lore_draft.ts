import type { LoreFragment, LoreKind } from './queries'

/** A fragment being edited, as the form holds it. */
export type LoreDraft = {
  reference: string
  kind: LoreKind
  content: string
  tags: string[]
  secret: boolean
}

/** A new fragment: a fact, sent with every turn until it is tagged. */
export function emptyLoreDraft(): LoreDraft {
  return { reference: '', kind: 'fact', content: '', tags: [], secret: false }
}

export function loreDraftOf(fragment: LoreFragment): LoreDraft {
  return {
    reference: fragment.reference,
    kind: fragment.kind,
    content: fragment.content,
    tags: fragment.tags,
    secret: fragment.secret,
  }
}

/**
 * The fragment as the backend takes it: the reference only on creation, and
 * never a secret ambiance — switching a secret fact to an ambiance drops the
 * secret rather than have the backend refuse it.
 */
export function lorePayloadOf(
  draft: LoreDraft,
  options: { creating: boolean }
): Record<string, unknown> {
  return {
    ...(options.creating ? { reference: draft.reference.trim() } : {}),
    kind: draft.kind,
    content: draft.content.trim(),
    tags: draft.tags,
    secret: draft.kind !== 'ambiance' && draft.secret,
  }
}
