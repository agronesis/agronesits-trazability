import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import { hasRequiredRole, resolveUserRoles, type AppRole } from '@/types/auth'

interface AuthState {
  user: User | null
  session: Session | null
  roles: AppRole[]
  primaryRole: AppRole | null
  loading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  hasRole: (role: AppRole) => boolean
  hasAnyRole: (allowedRoles?: AppRole[]) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      roles: [],
      primaryRole: null,
      loading: true,
      setUser: (user) => {
        const roles = resolveUserRoles(user)

        set({
          user,
          roles,
          primaryRole: roles[0] ?? null,
        })
      },
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),
      hasRole: (role) => get().roles.includes(role),
      hasAnyRole: (allowedRoles) => hasRequiredRole(get().roles, allowedRoles),
      logout: () => set({ user: null, session: null, roles: [], primaryRole: null }),
    }),
    {
      name: 'agronesis-auth',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        roles: state.roles,
        primaryRole: state.primaryRole,
      }),
    }
  )
)
