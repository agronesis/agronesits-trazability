import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { LoadingPage } from '@/components/shared/Spinner'
import { ROUTES } from '@/constants'
import type { AppRole } from '@/types/auth'
import { getDefaultRouteForRoles, hasPermission, type AppPermission } from '@/lib/permissions'

interface ProtectedRouteProps {
  allowedRoles?: AppRole[]
  permission?: AppPermission
  children?: ReactNode
}

export function ProtectedRoute({ allowedRoles, permission, children }: ProtectedRouteProps) {
  const { user, loading, roles, hasAnyRole } = useAuthStore()

  if (loading) return <LoadingPage message="Verificando sesión..." />
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />
  if (!hasAnyRole(allowedRoles)) return <Navigate to={getDefaultRouteForRoles(roles)} replace />
  if (permission && !hasPermission(roles, permission)) {
    return <Navigate to={getDefaultRouteForRoles(roles)} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
