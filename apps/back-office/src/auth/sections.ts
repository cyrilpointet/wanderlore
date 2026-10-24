import type { Role } from './session'

/** The roles the back-office is open to — each to its own sections. */
export const BACK_OFFICE_ROLES = ['game_master', 'superadmin'] as const
export type BackOfficeRole = (typeof BACK_OFFICE_ROLES)[number]

/** A part of the back-office, with the paths it covers. */
export type Section = 'worlds' | 'accounts'

/**
 * One account, one role: a game master writes the content, a superadmin
 * manages the accounts, and neither sees the other's section. The backend
 * refuses them regardless; this only spares them screens they cannot use.
 */
export const SECTIONS: Record<BackOfficeRole, Section[]> = {
  game_master: ['worlds'],
  superadmin: ['accounts'],
}

/** The first path of each section; a scenario's pages belong to the worlds. */
const PATHS: Record<Section, string[]> = {
  worlds: ['/worlds', '/scenarios'],
  accounts: ['/accounts'],
}

export const SECTION_HOME: Record<Section, string> = {
  worlds: '/worlds',
  accounts: '/accounts',
}

export function isBackOfficeRole(role: Role): role is BackOfficeRole {
  return (BACK_OFFICE_ROLES as readonly Role[]).includes(role)
}

/** Where an account of this role lands: its first section. */
export function homeOf(role: BackOfficeRole): string {
  return SECTION_HOME[SECTIONS[role][0]!]
}

/** Whether a path of the back-office belongs to a section of this role. */
export function canVisit(role: BackOfficeRole, pathname: string): boolean {
  const section = (Object.keys(PATHS) as Section[]).find((candidate) =>
    PATHS[candidate].some((path) => pathname === path || pathname.startsWith(`${path}/`))
  )

  return section === undefined || SECTIONS[role].includes(section)
}
