import type { AccountRole, NewAccount } from './queries'

/** A new account being typed. */
export type AccountDraft = {
  fullName: string
  email: string
  password: string
  role: AccountRole
}

export function emptyAccountDraft(): AccountDraft {
  return { fullName: '', email: '', password: '', role: 'player' }
}

/** The account as the backend takes it: name and email trimmed, the password as typed. */
export function accountPayloadOf(draft: AccountDraft): NewAccount {
  return {
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    password: draft.password,
    role: draft.role,
  }
}
