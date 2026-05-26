import { supabase } from '@/lib/supabase'

export interface TareoDiarioRow {
  colaborador_id: string
  dni: string | null
  nombre: string
  apellido: string
  rol: string
  kilos: number
  kilos_sugar: number
  kilos_snow: number
}

type Variedad = 'sugar' | 'snow_peas'

export async function getTareoDiario(fecha: string): Promise<TareoDiarioRow[]> {
  const mapa = new Map<string, TareoDiarioRow>()

  const getEntry = (
    id: string,
    colaborador: { dni?: string | null; nombre?: string | null; apellido?: string | null; rol?: string | null },
    rolFallback: string
  ) => {
    if (!mapa.has(id)) {
      mapa.set(id, {
        colaborador_id: id,
        dni: colaborador.dni ?? null,
        nombre: colaborador.nombre ?? '',
        apellido: colaborador.apellido ?? '',
        rol: colaborador.rol ?? rolFallback,
        kilos: 0,
        kilos_sugar: 0,
        kilos_snow: 0,
      })
    }
    return mapa.get(id)!
  }

  const acumular = (entry: TareoDiarioRow, kilos: number, variedad: Variedad | null) => {
    entry.kilos += kilos
    if (variedad === 'sugar') entry.kilos_sugar += kilos
    else if (variedad === 'snow_peas') entry.kilos_snow += kilos
  }

  // Recepcion: kg brutos pesados por recepcionista en la fecha de ingreso.
  const { data: lotes, error: errLotes } = await supabase
    .from('lotes')
    .select('recepcionista_id, peso_bruto_kg, producto:productos(variedad), recepcionista:colaboradores(id, dni, nombre, apellido, rol)')
    .not('recepcionista_id', 'is', null)
    .eq('fecha_ingreso', fecha)

  if (errLotes) throw new Error(errLotes.message)

  for (const row of (lotes ?? []) as any[]) {
    const colaborador = row.recepcionista
    const id = row.recepcionista_id as string | null
    if (!id || !colaborador) continue

    const entry = getEntry(id, colaborador, 'recepcionista')
    const variedad = (row.producto?.variedad ?? null) as Variedad | null
    acumular(entry, Number(row.peso_bruto_kg ?? 0), variedad)
  }

  // Seleccion: kg exportables (cat1 + cat2) por seleccionador en fecha de clasificacion.
  const { data: sesiones, error: errSesiones } = await supabase
    .from('clasificaciones')
    .select('id, lote:lotes(producto:productos(variedad))')
    .eq('fecha_clasificacion', fecha)

  if (errSesiones) throw new Error(errSesiones.message)

  const sesionVariedad = new Map<string, Variedad | null>()
  for (const s of (sesiones ?? []) as any[]) {
    sesionVariedad.set(s.id as string, (s.lote?.producto?.variedad ?? null) as Variedad | null)
  }

  const idsSesiones = Array.from(sesionVariedad.keys())

  if (idsSesiones.length > 0) {
    const { data: aportes, error: errAportes } = await supabase
      .from('clasificacion_aportes')
      .select('clasificacion_id, colaborador_id, kg_cat1, kg_cat2, colaborador:colaboradores(id, dni, nombre, apellido, rol)')
      .in('clasificacion_id', idsSesiones)

    if (errAportes) throw new Error(errAportes.message)

    for (const row of (aportes ?? []) as any[]) {
      const colaborador = row.colaborador
      const id = row.colaborador_id as string | null
      if (!id || !colaborador) continue

      const entry = getEntry(id, colaborador, 'seleccionador')
      const variedad = sesionVariedad.get(row.clasificacion_id as string) ?? null
      const kilos = Number(row.kg_cat1 ?? 0) + Number(row.kg_cat2 ?? 0)
      acumular(entry, kilos, variedad)
    }
  }

  const redondear = (n: number) => Math.round(n * 100) / 100

  return Array.from(mapa.values())
    .filter((r) => r.kilos > 0)
    .map((r) => ({
      ...r,
      kilos: redondear(r.kilos),
      kilos_sugar: redondear(r.kilos_sugar),
      kilos_snow: redondear(r.kilos_snow),
    }))
    .sort((a, b) => {
      if (a.rol !== b.rol) return a.rol.localeCompare(b.rol)
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)
    })
}
