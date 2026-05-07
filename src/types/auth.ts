import type { User } from '@supabase/supabase-js'

export const APP_ROLES = {
  ADMIN: 'admin',
  GERENCIA: 'gerencia',
  ADMINISTRADOR_PLANTA: 'administrador_planta',
  TESORERIA: 'tesoreria',
  OPERATIVO_RECEPCION: 'operativo_recepcion',
  OPERATIVO_PLANTA: 'operativo_planta',
  OPERATIVO_PLANTA_DESPACHO: 'operativo_planta_despacho',
} as const

export type AppRole = string

export interface UserRoleMetadata {
  role?: AppRole | null
  roles?: AppRole[] | null
}

function isNonEmptyRole(value: unknown): value is AppRole {
  return typeof value === 'string' && value.trim().length > 0
}

function getMetadataRoles(metadata: unknown): AppRole[] {
  if (!metadata || typeof metadata !== 'object') {
    return []
  }

  const { role, roles } = metadata as UserRoleMetadata

  if (Array.isArray(roles)) {
    return roles.filter(isNonEmptyRole)
  }

  if (isNonEmptyRole(role)) {
    return [role]
  }

  return []
}

export function resolveUserRoles(user: User | null): AppRole[] {
  if (!user) {
    return []
  }

  const appMetadataRoles = getMetadataRoles(user.app_metadata)
  if (appMetadataRoles.length > 0) {
    return appMetadataRoles
  }

  return getMetadataRoles(user.user_metadata)
}

export function resolvePrimaryRole(user: User | null): AppRole | null {
  return resolveUserRoles(user)[0] ?? null
}

export function hasRequiredRole(userRoles: AppRole[], allowedRoles?: AppRole[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true
  }

  return allowedRoles.some((role) => userRoles.includes(role))
}
