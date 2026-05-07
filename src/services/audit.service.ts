import { supabase } from '@/lib/supabase'

export type AccionAudit = 'crear' | 'actualizar' | 'eliminar'

export interface AuditLog {
  id: string
  created_at: string
  user_id: string
  user_email: string
  accion: AccionAudit
  modulo: string
  registro_id: string
  descripcion: string
  datos_anteriores: Record<string, unknown> | null
  datos_nuevos: Record<string, unknown> | null
}

/**
 * Registra una acción en el log de auditoría.
 * Los errores se capturan silenciosamente para no bloquear la operación principal.
 */
export async function logAudit(params: {
  userId: string
  userEmail: string
  accion: AccionAudit
  modulo: string
  registroId: string
  descripcion: string
  datosAnteriores?: Record<string, unknown> | null
  datosNuevos?: Record<string, unknown> | null
}): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: params.userId,
    user_email: params.userEmail,
    accion: params.accion,
    modulo: params.modulo,
    registro_id: params.registroId,
    descripcion: params.descripcion,
    datos_anteriores: params.datosAnteriores ?? null,
    datos_nuevos: params.datosNuevos ?? null,
  })

  if (error) {
    console.warn('[audit] Error al registrar log:', error.message)
  }
}

export async function getAuditLogs(params?: {
  modulo?: string
  desde?: string
  hasta?: string
  limit?: number
}): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 300)

  if (params?.modulo) {
    query = query.eq('modulo', params.modulo)
  }
  if (params?.desde) {
    query = query.gte('created_at', params.desde)
  }
  if (params?.hasta) {
    const hastaFin = new Date(params.hasta)
    hastaFin.setDate(hastaFin.getDate() + 1)
    query = query.lt('created_at', hastaFin.toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AuditLog[]
}
