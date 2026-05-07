import { supabase } from '@/lib/supabase'

export interface TareoDiarioRow {
  colaborador_id: string
  dni: string | null
  nombre: string
  apellido: string
  rol: string
  kilos: number
}

export async function getTareoDiario(fecha: string): Promise<TareoDiarioRow[]> {
  const mapa = new Map<string, TareoDiarioRow>()

  // Recepcion: kg brutos pesados por recepcionista en la fecha de ingreso.
  const { data: lotes, error: errLotes } = await supabase
    .from('lotes')
    .select('recepcionista_id, peso_bruto_kg, recepcionista:colaboradores(id, dni, nombre, apellido, rol)')
    .not('recepcionista_id', 'is', null)
    .eq('fecha_ingreso', fecha)

  if (errLotes) throw new Error(errLotes.message)

  for (const row of (lotes ?? []) as any[]) {
    const colaborador = row.recepcionista
    const id = row.recepcionista_id as string | null
    if (!id || !colaborador) continue

    if (!mapa.has(id)) {
      mapa.set(id, {
        colaborador_id: id,
        dni: colaborador.dni ?? null,
        nombre: colaborador.nombre ?? '',
        apellido: colaborador.apellido ?? '',
        rol: colaborador.rol ?? 'recepcionista',
        kilos: 0,
      })
    }

    const entry = mapa.get(id)!
    entry.kilos += Number(row.peso_bruto_kg ?? 0)
  }

  // Seleccion: kg exportables (cat1 + cat2) por seleccionador en fecha de clasificacion.
  const { data: sesiones, error: errSesiones } = await supabase
    .from('clasificaciones')
    .select('id')
    .eq('fecha_clasificacion', fecha)

  if (errSesiones) throw new Error(errSesiones.message)

  const idsSesiones = (sesiones ?? []).map((s: any) => s.id as string)

  if (idsSesiones.length > 0) {
    const { data: aportes, error: errAportes } = await supabase
      .from('clasificacion_aportes')
      .select('colaborador_id, kg_cat1, kg_cat2, colaborador:colaboradores(id, dni, nombre, apellido, rol)')
      .in('clasificacion_id', idsSesiones)

    if (errAportes) throw new Error(errAportes.message)

    for (const row of (aportes ?? []) as any[]) {
      const colaborador = row.colaborador
      const id = row.colaborador_id as string | null
      if (!id || !colaborador) continue

      if (!mapa.has(id)) {
        mapa.set(id, {
          colaborador_id: id,
          dni: colaborador.dni ?? null,
          nombre: colaborador.nombre ?? '',
          apellido: colaborador.apellido ?? '',
          rol: colaborador.rol ?? 'seleccionador',
          kilos: 0,
        })
      }

      const entry = mapa.get(id)!
      entry.kilos += Number(row.kg_cat1 ?? 0) + Number(row.kg_cat2 ?? 0)
    }
  }

  return Array.from(mapa.values())
    .filter((r) => r.kilos > 0)
    .map((r) => ({ ...r, kilos: Math.round(r.kilos * 100) / 100 }))
    .sort((a, b) => {
      if (a.rol !== b.rol) return a.rol.localeCompare(b.rol)
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)
    })
}
