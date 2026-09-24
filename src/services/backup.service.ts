import { supabase } from '@/lib/supabase'

// Tablas que se respaldan, en orden de dependencia: primero los maestros y
// luego lo que los referencia. Ese orden es el que habria que seguir para
// volver a cargarlas, porque cada una apunta a las de arriba.
export const TABLAS_BACKUP = [
  'agricultores',
  'acopiadores',
  'colaboradores',
  'productos',
  'centros_acopio',
  'agricultor_producto_hectareas',
  'agricultor_sublotes',
  'config_precios',
  'config_sistema',
  'lotes',
  'clasificaciones',
  'clasificacion_aportes',
  'empaquetados',
  'despachos',
  'despacho_pallets',
  'liquidaciones_agri',
  'liquidacion_agri_detalle',
  'planillas_quincenales',
  'planilla_detalles',
  'movimientos_cubetas',
  'audit_logs',
] as const

export type TablaBackup = (typeof TABLAS_BACKUP)[number]

export interface TablaRespaldada {
  tabla: TablaBackup
  filas: Array<Record<string, unknown>>
}

// PostgREST corta en 1000 filas por respuesta, asi que hay que paginar. Con
// 10.000 lotes son once vueltas solo para esa tabla.
const TAMANO_PAGINA = 1000

async function descargarTabla(tabla: TablaBackup): Promise<Array<Record<string, unknown>>> {
  const filas: Array<Record<string, unknown>> = []

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      .order('created_at', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) {
      throw new Error(`No se pudo leer la tabla ${tabla}: ${error.message}`)
    }

    const pagina = (data ?? []) as Array<Record<string, unknown>>
    filas.push(...pagina)

    if (pagina.length < TAMANO_PAGINA) return filas
  }
}

export interface ProgresoBackup {
  tabla: TablaBackup
  indice: number
  total: number
  filas: number
}

/**
 * Descarga todas las tablas del sistema. Se llama con la sesion del usuario,
 * asi que solo devuelve lo que las policies le permiten ver.
 */
export async function descargarTodasLasTablas(
  onProgreso?: (progreso: ProgresoBackup) => void,
): Promise<TablaRespaldada[]> {
  const resultado: TablaRespaldada[] = []

  // En serie y no en paralelo: son miles de filas y no tiene sentido saturar
  // la conexion ni el plan gratuito de Supabase por ahorrar unos segundos.
  for (const [indice, tabla] of TABLAS_BACKUP.entries()) {
    const filas = await descargarTabla(tabla)
    resultado.push({ tabla, filas })
    onProgreso?.({ tabla, indice: indice + 1, total: TABLAS_BACKUP.length, filas: filas.length })
  }

  return resultado
}
