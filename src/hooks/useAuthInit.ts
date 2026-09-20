import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

export function useAuthInit() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
      })
      .catch((error) => {
        // Si Supabase no responde (red caida, proyecto inalcanzable) hay que
        // soltar el loading igual: sin esto la app se queda colgada para
        // siempre en "Verificando sesion..." y no llega ni al login.
        console.error('No se pudo verificar la sesion inicial:', error)
        setSession(null)
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setLoading])
}
