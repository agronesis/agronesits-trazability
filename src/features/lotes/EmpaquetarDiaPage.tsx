import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, Loader2, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROUTES, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { CLAVE_PESO_CAJA_EXPORTACION, getValorNumericoSistema } from '@/services/config-precios.service'
import { getLotesEmpaquetadoOperacion, type LoteEmpaquetadoOperacionRow, actualizarEstadoLote } from '@/services/lotes.service'
import { createEmpaquetado, getResumenPalletsEmpaquetado } from '@/services/empaquetados.service'
import { getColaboradores } from '@/services/colaboradores.service'
import { calcularCajasExportables, DEFAULT_PESO_CAJA_EXPORTACION_KG, CAJAS_POR_PALLET, normalizarNumeroPallet } from '@/utils/business-rules'
import { formatFecha } from '@/utils/formatters'
import { useAuthStore } from '@/store/auth.store'
import type { Colaborador, DestinoEmpaquetado, Lote, VariedadProducto } from '@/types/models'
import { getTraceabilityCodeForDate } from './printDespachoLabel'

type PasoEmpaquetado = 1 | 2

type LoteResumen = {
  loteId: string
  codigo: string
  codigoAgricultor: string | null
  sublote: string | null
  fechaCosecha: string
  agricultorId: string | null
  agricultorNombre: string
  agricultorNombreOriginal: string | null
  agricultorApellido: string | null
  variedad: VariedadProducto | null
  estado: LoteEmpaquetadoOperacionRow['estado']
  cajasExportables: number
}

type FilaEmpaquetado = {
  filaId: string
  loteId: string
  segmento: number
  incluir: boolean
  numeroPallet: string
  numCajas: string
}

type AgricultorDistribucion = {
  key: string
  agricultorNombre: string
  totalCajas: number
  totalLotes: number
}

const PAGE_SIZE = 25

function normalizarArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return [value]
  return []
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getNombreAgricultor(row: LoteEmpaquetadoOperacionRow): string {
  if (!row.agricultor) return 'Sin agricultor'
  return `${row.agricultor.apellido}, ${row.agricultor.nombre}`
}

function getAgricultorKey(lote: LoteResumen): string {
  return lote.agricultorId ?? `lote:${lote.loteId}`
}

function repartirCajasEquitativamente(totalCajas: number, empaquetadorIds: string[]): Record<string, number> {
  if (totalCajas <= 0 || empaquetadorIds.length === 0) return {}

  const base = Math.floor(totalCajas / empaquetadorIds.length)
  const residuo = totalCajas % empaquetadorIds.length

  return empaquetadorIds.reduce<Record<string, number>>((acc, empaquetadorId, index) => {
    acc[empaquetadorId] = base + (index < residuo ? 1 : 0)
    return acc
  }, {})
}

function parseCajasAsignadasInput(value: string): number | null {
  const raw = value.trim()
  if (raw === '') return 0
  if (!/^\d+$/.test(raw)) return null
  return Number(raw)
}

function construirObjetivosFinales(
  totalCajas: number,
  empaquetadorIds: string[],
  cajasEditadas: Record<string, string>
): Record<string, number> {
  const objetivos = empaquetadorIds.reduce<Record<string, number>>((acc, empaquetadorId) => {
    const parsed = parseCajasAsignadasInput(cajasEditadas[empaquetadorId] ?? '0')
    acc[empaquetadorId] = Math.max(0, parsed ?? 0)
    return acc
  }, {})

  const totalEditado = empaquetadorIds.reduce((acc, empaquetadorId) => acc + (objetivos[empaquetadorId] ?? 0), 0)
  if (totalEditado >= totalCajas) return objetivos

  const faltante = totalCajas - totalEditado
  const ajuste = repartirCajasEquitativamente(faltante, empaquetadorIds)

  empaquetadorIds.forEach((empaquetadorId) => {
    objetivos[empaquetadorId] = (objetivos[empaquetadorId] ?? 0) + (ajuste[empaquetadorId] ?? 0)
  })

  return objetivos
}

function repartirCajasPorLote(
  filas: FilaEmpaquetado[],
  empaquetadorIds: string[],
  objetivosPorEmpaquetador: Record<string, number>
): Record<string, Record<string, number>> {
  if (empaquetadorIds.length === 0) return {}

  const restantesPorEmpaquetador = empaquetadorIds.reduce<Record<string, number>>((acc, empaquetadorId) => {
    acc[empaquetadorId] = Math.max(0, objetivosPorEmpaquetador[empaquetadorId] ?? 0)
    return acc
  }, {})
  const prioridadEmpaquetadores = new Map(empaquetadorIds.map((id, index) => [id, index]))
  const repartoPorLote: Record<string, Record<string, number>> = {}

  filas.forEach((fila) => {
    let cajasPendientes = parseInt(fila.numCajas, 10) || 0
    if (cajasPendientes <= 0) return

    const repartoLote: Record<string, number> = {}

    while (cajasPendientes > 0) {
      const disponibles = empaquetadorIds
        .filter((id) => (restantesPorEmpaquetador[id] ?? 0) > 0)
        .sort((a, b) => {
          const diff = (restantesPorEmpaquetador[b] ?? 0) - (restantesPorEmpaquetador[a] ?? 0)
          if (diff !== 0) return diff
          return (prioridadEmpaquetadores.get(a) ?? 0) - (prioridadEmpaquetadores.get(b) ?? 0)
        })

      if (disponibles.length === 0) break

      for (const empaquetadorId of disponibles) {
        if (cajasPendientes === 0) break
        if ((restantesPorEmpaquetador[empaquetadorId] ?? 0) <= 0) continue

        repartoLote[empaquetadorId] = (repartoLote[empaquetadorId] ?? 0) + 1
        restantesPorEmpaquetador[empaquetadorId] -= 1
        cajasPendientes -= 1
      }
    }

    repartoPorLote[fila.filaId] = repartoLote
  })

  return repartoPorLote
}

function toLoteForTrazabilidad(lote: LoteResumen): Lote {
  return {
    id: lote.loteId,
    codigo: lote.codigo,
    codigo_lote_agricultor: lote.codigoAgricultor,
    fecha_cosecha: lote.fechaCosecha,
    agricultor: lote.agricultorNombreOriginal
      ? { nombre: lote.agricultorNombreOriginal, apellido: lote.agricultorApellido ?? '' }
      : null,
  } as unknown as Lote
}

function StepperItem({
  numero,
  titulo,
  activo,
  completado,
  onClick,
  disabled,
}: {
  numero: PasoEmpaquetado
  titulo: string
  activo: boolean
  completado: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div
        className={[
          'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold',
          activo ? 'border-indigo-600 bg-indigo-600 text-white' : '',
          !activo && completado ? 'border-emerald-600 bg-emerald-600 text-white' : '',
          !activo && !completado ? 'border-slate-300 bg-white text-slate-500' : '',
        ].join(' ')}
      >
        {numero}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Paso {numero}</p>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
      </div>
    </button>
  )
}

export default function EmpaquetarDiaPage() {
  const navigate = useNavigate()
  const { fecha = '' } = useParams<{ fecha: string }>()
  const { user } = useAuthStore()

  const [rows, setRows] = useState<LoteEmpaquetadoOperacionRow[]>([])
  const [pesoCajaExportacionKg, setPesoCajaExportacionKg] = useState(DEFAULT_PESO_CAJA_EXPORTACION_KG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fechaEmpaquetado, setFechaEmpaquetado] = useState(fecha)
  const [destino, setDestino] = useState<DestinoEmpaquetado>('europa')
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [filas, setFilas] = useState<FilaEmpaquetado[]>([])
  const [pasoActual, setPasoActual] = useState<PasoEmpaquetado>(1)
  const [empaquetadoresActivos, setEmpaquetadoresActivos] = useState<string[]>([])
  const [cajasAsignadasEditadas, setCajasAsignadasEditadas] = useState<Record<string, string>>({})
  const [empaquetadorSearch, setEmpaquetadorSearch] = useState('')
  const [empaquetadorPickerOpen, setEmpaquetadorPickerOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [palletOcupacion, setPalletOcupacion] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!fecha) return
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      getLotesEmpaquetadoOperacion(fecha),
      getValorNumericoSistema(CLAVE_PESO_CAJA_EXPORTACION, DEFAULT_PESO_CAJA_EXPORTACION_KG),
      getResumenPalletsEmpaquetado(),
    ])
      .then(([data, peso, pallets]) => {
        if (!active) return
        setRows(data)
        setPesoCajaExportacionKg(peso)
        setPalletOcupacion(pallets)
      })
      .catch((e) => {
        if (active) setError((e as Error).message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [fecha])

  useEffect(() => {
    getColaboradores()
      .then((cols) => setColaboradores(cols.filter((colaborador) => colaborador.rol === 'empaquetador')))
      .catch(() => setColaboradores([]))
  }, [])

  const lotesResumen = useMemo<LoteResumen[]>(() => {
    return rows.map((row) => {
      const pesoBuenoKg = normalizarArray(row.clasificaciones).reduce(
        (acc, clasificacion) => acc + (clasificacion.peso_bueno_kg ?? 0),
        0
      )

      return {
        loteId: row.id,
        codigo: row.codigo,
        codigoAgricultor: row.codigo_lote_agricultor,
        sublote: row.sublote,
        fechaCosecha: row.fecha_cosecha,
        agricultorId: row.agricultor?.id ?? null,
        agricultorNombre: getNombreAgricultor(row),
        agricultorNombreOriginal: row.agricultor?.nombre ?? null,
        agricultorApellido: row.agricultor?.apellido ?? null,
        variedad: row.producto?.variedad ?? null,
        estado: row.estado,
        cajasExportables: calcularCajasExportables(pesoBuenoKg, pesoCajaExportacionKg),
      }
    })
  }, [pesoCajaExportacionKg, rows])

  const clasificados = useMemo(
    () => lotesResumen.filter((lote) => lote.estado === 'clasificado'),
    [lotesResumen]
  )
  const sinClasificar = useMemo(
    () => lotesResumen.filter((lote) => lote.estado === 'ingresado'),
    [lotesResumen]
  )

  useEffect(() => {
    const nuevasFilas: FilaEmpaquetado[] = []
    clasificados.forEach((lote) => {
      if (lote.cajasExportables <= 0) {
        nuevasFilas.push({
          filaId: `${lote.loteId}-0`,
          loteId: lote.loteId,
          segmento: 0,
          incluir: true,
          numeroPallet: '',
          numCajas: '',
        })
        return
      }
      let restante = lote.cajasExportables
      let segmento = 0
      while (restante > 0) {
        const cajas = Math.min(restante, CAJAS_POR_PALLET)
        nuevasFilas.push({
          filaId: `${lote.loteId}-${segmento}`,
          loteId: lote.loteId,
          segmento,
          incluir: true,
          numeroPallet: '',
          numCajas: String(cajas),
        })
        restante -= cajas
        segmento++
      }
    })
    setFilas(nuevasFilas)
  }, [clasificados])

  const loteById = useMemo(() => {
    const mapa = new Map<string, LoteResumen>()
    clasificados.forEach((lote) => mapa.set(lote.loteId, lote))
    return mapa
  }, [clasificados])

  const filasByLote = useMemo(() => {
    const mapa = new Map<string, FilaEmpaquetado[]>()
    filas.forEach((fila) => {
      if (!mapa.has(fila.loteId)) mapa.set(fila.loteId, [])
      mapa.get(fila.loteId)!.push(fila)
    })
    return mapa
  }, [filas])

  const filasFiltradas = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return filas

    return filas.filter((fila) => {
      const lote = loteById.get(fila.loteId)
      if (!lote) return false

      return (
        lote.codigo.toLowerCase().includes(query) ||
        (lote.codigoAgricultor?.toLowerCase().includes(query) ?? false) ||
        (lote.sublote?.toLowerCase().includes(query) ?? false) ||
        lote.agricultorNombre.toLowerCase().includes(query)
      )
    })
  }, [filas, loteById, search])

  // For pagination we group by lot, not by individual segment row
  const lotesFiltradosOrdenados = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const fila of filasFiltradas) {
      if (!seen.has(fila.loteId)) {
        seen.add(fila.loteId)
        result.push(fila.loteId)
      }
    }
    return result
  }, [filasFiltradas])

  const totalPages = Math.max(1, Math.ceil(lotesFiltradosOrdenados.length / PAGE_SIZE))
  const pageActual = Math.min(page, totalPages)
  const lotesPagina = useMemo(
    () => lotesFiltradosOrdenados.slice((pageActual - 1) * PAGE_SIZE, pageActual * PAGE_SIZE),
    [lotesFiltradosOrdenados, pageActual]
  )

  useEffect(() => {
    setPage(1)
  }, [search])

  const filasIncluidas = useMemo(() => filas.filter((fila) => fila.incluir), [filas])
  const lotesIncluidosCount = useMemo(
    () => new Set(filasIncluidas.map((fila) => fila.loteId)).size,
    [filasIncluidas]
  )
  const totalCajasExportables = clasificados.reduce((acc, lote) => acc + lote.cajasExportables, 0)
  const totalCajasAEmpaquetar = filasIncluidas.reduce((acc, fila) => acc + (parseInt(fila.numCajas, 10) || 0), 0)

  const agricultoresDistribucion = useMemo<AgricultorDistribucion[]>(() => {
    const mapa = new Map<string, AgricultorDistribucion>()

    filasIncluidas.forEach((fila) => {
      const lote = loteById.get(fila.loteId)
      if (!lote) return

      const cajas = parseInt(fila.numCajas, 10) || 0
      const key = getAgricultorKey(lote)
      const actual = mapa.get(key)

      if (actual) {
        actual.totalCajas += cajas
        actual.totalLotes += 1
        return
      }

      mapa.set(key, {
        key,
        agricultorNombre: lote.agricultorNombre,
        totalCajas: cajas,
        totalLotes: 1,
      })
    })

    return Array.from(mapa.values()).sort((a, b) => a.agricultorNombre.localeCompare(b.agricultorNombre))
  }, [filasIncluidas, loteById])

  const empaquetadoresActivosDetalle = useMemo(
    () => colaboradores.filter((colaborador) => empaquetadoresActivos.includes(colaborador.id)),
    [colaboradores, empaquetadoresActivos]
  )

  const empaquetadoresFiltrados = useMemo(() => {
    const query = normalizeSearchText(empaquetadorSearch)
    if (!query) return colaboradores

    return colaboradores.filter((colaborador) => (
      normalizeSearchText(`${colaborador.apellido} ${colaborador.nombre} ${colaborador.codigo} ${colaborador.dni ?? ''}`)
        .includes(query)
    ))
  }, [colaboradores, empaquetadorSearch])

  const cajasSugeridasAutomaticas = useMemo(
    () => repartirCajasEquitativamente(totalCajasAEmpaquetar, empaquetadoresActivosDetalle.map((empaquetador) => empaquetador.id)),
    [empaquetadoresActivosDetalle, totalCajasAEmpaquetar]
  )

  useEffect(() => {
    setCajasAsignadasEditadas(() => {
      const next: Record<string, string> = {}
      empaquetadoresActivosDetalle.forEach((empaquetador) => {
        next[empaquetador.id] = String(cajasSugeridasAutomaticas[empaquetador.id] ?? 0)
      })
      return next
    })
  }, [cajasSugeridasAutomaticas, empaquetadoresActivosDetalle])

  const cajasParseadasPorEmpaquetador = useMemo(() => {
    return empaquetadoresActivosDetalle.reduce<Record<string, number | null>>((acc, empaquetador) => {
      acc[empaquetador.id] = parseCajasAsignadasInput(cajasAsignadasEditadas[empaquetador.id] ?? '0')
      return acc
    }, {})
  }, [cajasAsignadasEditadas, empaquetadoresActivosDetalle])

  const existeFormatoCajasInvalido = useMemo(
    () => Object.values(cajasParseadasPorEmpaquetador).some((value) => value === null),
    [cajasParseadasPorEmpaquetador]
  )

  const totalCajasEditadas = useMemo<number>(
    () => Object.values(cajasParseadasPorEmpaquetador).reduce<number>((acc, value) => acc + (value ?? 0), 0),
    [cajasParseadasPorEmpaquetador]
  )

  const excedeTotalCajas = totalCajasEditadas > totalCajasAEmpaquetar
  const faltanteCajas = Math.max(0, totalCajasAEmpaquetar - totalCajasEditadas)

  const todosVisiblesIncluidos = filasFiltradas.length > 0 && filasFiltradas.every((fila) => fila.incluir)

  function actualizarFila(filaId: string, campo: Partial<FilaEmpaquetado>) {
    setErrorGlobal(null)
    setFilas((prev) => prev.map((fila) => (fila.filaId === filaId ? { ...fila, ...campo } : fila)))
  }

  function toggleTodosVisibles(incluir: boolean) {
    setErrorGlobal(null)
    const idsVisibles = new Set(filasFiltradas.map((fila) => fila.filaId))
    setFilas((prev) => prev.map((fila) => (idsVisibles.has(fila.filaId) ? { ...fila, incluir } : fila)))
  }

  function toggleEmpaquetadorActivo(empaquetadorId: string, checked: boolean) {
    setErrorGlobal(null)
    setEmpaquetadoresActivos((prev) => {
      if (checked) {
        if (prev.includes(empaquetadorId)) return prev
        return [...prev, empaquetadorId]
      }
      return prev.filter((id) => id !== empaquetadorId)
    })
  }

  function actualizarCajasEditadas(empaquetadorId: string, value: string) {
    setErrorGlobal(null)
    setCajasAsignadasEditadas((prev) => ({
      ...prev,
      [empaquetadorId]: value,
    }))
  }

  function validarPaso1(): boolean {
    const nextErrors: Record<string, string> = {}

    // Compute total boxes per pallet across all included rows
    const cajasEnFormaPorPallet: Record<string, number> = {}
    for (const fila of filas) {
      if (!fila.incluir) continue
      const palletNorm = normalizarNumeroPallet(fila.numeroPallet)
      if (palletNorm) {
        cajasEnFormaPorPallet[palletNorm] = (cajasEnFormaPorPallet[palletNorm] ?? 0) + (parseInt(fila.numCajas, 10) || 0)
      }
    }

    for (const fila of filas) {
      if (!fila.incluir) continue

      if (!fila.numeroPallet.trim()) {
        nextErrors[`${fila.filaId}-pallet`] = 'Requerido'
      } else {
        const palletNorm = normalizarNumeroPallet(fila.numeroPallet)
        const cajasExistentes = palletOcupacion[palletNorm] ?? 0
        const totalEnPallet = cajasExistentes + (cajasEnFormaPorPallet[palletNorm] ?? 0)
        if (totalEnPallet > CAJAS_POR_PALLET) {
          nextErrors[`${fila.filaId}-pallet`] = `Excede capacidad: ${cajasExistentes} exist. + ${cajasEnFormaPorPallet[palletNorm] ?? 0} nuevas = ${totalEnPallet}/${CAJAS_POR_PALLET}`
        }
      }

      const cajas = parseInt(fila.numCajas, 10)
      if (isNaN(cajas) || cajas <= 0) nextErrors[`${fila.filaId}-cajas`] = 'Debe ser > 0'
    }

    setErrores(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function enfocarPrimeraFilaConError() {
    const primeraFilaConError = filas.find((fila) => fila.incluir && (
      !fila.numeroPallet.trim() || isNaN(parseInt(fila.numCajas, 10)) || parseInt(fila.numCajas, 10) <= 0
    ))

    if (!primeraFilaConError) return

    const loteIdx = lotesFiltradosOrdenados.findIndex((loteId) => loteId === primeraFilaConError.loteId)
    if (loteIdx >= 0) {
      setPage(Math.floor(loteIdx / PAGE_SIZE) + 1)
      return
    }

    setSearch('')
  }

  function validarPaso2(): boolean {
    if (empaquetadoresActivosDetalle.length === 0) {
      setErrorGlobal('Seleccione al menos un empaquetador que haya laborado en el día.')
      return false
    }

    if (existeFormatoCajasInvalido) {
      setErrorGlobal('Las cajas asignadas deben ser valores enteros mayores o iguales a 0.')
      return false
    }

    if (excedeTotalCajas) {
      setErrorGlobal(`La suma de cajas asignadas (${totalCajasEditadas}) no puede exceder las cajas a repartir (${totalCajasAEmpaquetar}).`)
      return false
    }

    return true
  }

  function handleContinuarPaso2() {
    setErrorGlobal(null)

    if (!validarPaso1()) {
      enfocarPrimeraFilaConError()
      return
    }

    setPasoActual(2)
  }

  function handleIrAPaso(paso: PasoEmpaquetado) {
    if (paso === pasoActual) return
    if (paso === 1) {
      setErrorGlobal(null)
      setPasoActual(1)
      return
    }

    handleContinuarPaso2()
  }

  async function handleConfirmar() {
    setErrorGlobal(null)

    if (!validarPaso1()) {
      setPasoActual(1)
      enfocarPrimeraFilaConError()
      return
    }

    if (!validarPaso2()) return
    if (!user) return

    setGuardando(true)
    try {
      const idsEmpaquetadores = empaquetadoresActivosDetalle.map((empaquetador) => empaquetador.id)
      const objetivosFinales = construirObjetivosFinales(totalCajasAEmpaquetar, idsEmpaquetadores, cajasAsignadasEditadas)
      const repartoPorLote = repartirCajasPorLote(
        filasIncluidas,
        idsEmpaquetadores,
        objetivosFinales
      )

      const lotesActualizados = new Set<string>()
      for (const fila of filasIncluidas) {
        const lote = loteById.get(fila.loteId)
        if (!lote) continue

        const codigoTrazabilidad = getTraceabilityCodeForDate(toLoteForTrazabilidad(lote), fechaEmpaquetado)
        const repartoLote = repartoPorLote[fila.filaId] ?? {}

        for (const empaquetadorId of Object.keys(repartoLote)) {
          const cajasAsignadas = repartoLote[empaquetadorId] ?? 0
          if (cajasAsignadas <= 0) continue

          await createEmpaquetado(
            {
              lote_id: fila.loteId,
              colaborador_id: empaquetadorId,
              fecha_empaquetado: fechaEmpaquetado,
              destino,
              codigo_trazabilidad: codigoTrazabilidad,
              numero_pallet: fila.numeroPallet.trim(),
              num_cajas: cajasAsignadas,
              observaciones: null,
            },
            user.id
          )
        }

        if (!lotesActualizados.has(fila.loteId)) {
          await actualizarEstadoLote(fila.loteId, 'empaquetado')
          lotesActualizados.add(fila.loteId)
        }
      }

      navigate(ROUTES.EMPAQUETADO_OPERACIONES)
    } catch (e) {
      setErrorGlobal((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <PageHeader
        title={`Empaquetar día — ${formatFecha(fecha)}`}
        description={`${clasificados.length} lote${clasificados.length !== 1 ? 's' : ''} clasificado${clasificados.length !== 1 ? 's' : ''} disponibles`}
        actions={
          <Button variant="outline" onClick={() => navigate(ROUTES.EMPAQUETADO_OPERACIONES)}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <StepperItem
            numero={1}
            titulo="Lotes del día"
            activo={pasoActual === 1}
            completado={pasoActual === 2}
            onClick={() => handleIrAPaso(1)}
            disabled={guardando}
          />
          <div className="hidden h-px w-10 bg-slate-300 sm:block" />
          <StepperItem
            numero={2}
            titulo="Empaquetadores"
            activo={pasoActual === 2}
            completado={false}
            onClick={() => handleIrAPaso(2)}
            disabled={guardando || filasIncluidas.length === 0}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {pasoActual === 1
            ? 'Define qué lotes se empaquetarán hoy y cuántas cajas saldrán por lote.'
            : 'Selecciona quiénes laboraron y reparte automáticamente las cajas por agricultor.'}
        </p>
      </div>

      {sinClasificar.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {sinClasificar.length} lote{sinClasificar.length > 1 ? 's' : ''} sin clasificar — no se incluirán:
              </p>
              <ul className="mt-1 list-disc list-inside text-xs text-amber-700">
                {sinClasificar.map((lote) => (
                  <li key={lote.loteId}>
                    {lote.codigoAgricultor ?? lote.codigo}{lote.sublote ? ` - ${lote.sublote}` : ''} · {lote.agricultorNombre}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {pasoActual === 1 ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Cajas exportables</p>
              <p className="mt-1 text-3xl font-bold text-indigo-900">{totalCajasExportables}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-green-700">Cajas a empaquetar</p>
              <p className="mt-1 text-3xl font-bold text-green-900">{totalCajasAEmpaquetar}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-700">Lotes incluidos</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{lotesIncluidosCount} / {clasificados.length}</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Fecha de empaquetado</Label>
              <Input
                type="date"
                value={fechaEmpaquetado}
                onChange={(e) => setFechaEmpaquetado(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Destino</Label>
              <Select value={destino} onValueChange={(value) => setDestino(value as DestinoEmpaquetado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="europa">Europa</SelectItem>
                  <SelectItem value="usa">USA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {clasificados.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, agricultor, sublote..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={todosVisiblesIncluidos}
                  onCheckedChange={(checked) => toggleTodosVisibles(!!checked)}
                  id="toggle-all"
                />
                <Label htmlFor="toggle-all" className="cursor-pointer">
                  Incluir todos los visibles
                </Label>
              </div>
            </div>
          )}

          {clasificados.length === 0 ? (
            <p className="rounded-lg border bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
              No hay lotes clasificados para este día.
            </p>
          ) : lotesPagina.length === 0 ? (
            <p className="rounded-lg border bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
              Ningún lote coincide con la búsqueda.
            </p>
          ) : (
            <div className="space-y-2">
              {lotesPagina.map((loteId) => {
                const lote = loteById.get(loteId)
                if (!lote) return null

                const filasLote = filasByLote.get(loteId) ?? []
                const algSegmentoIncluido = filasLote.some((f) => f.incluir)

                return (
                  <div
                    key={loteId}
                    className={`rounded-lg border p-3 transition-colors ${algSegmentoIncluido ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}
                  >
                    {/* Lot header */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        {lote.codigoAgricultor ?? lote.codigo}{lote.sublote ? ` - ${lote.sublote}` : ''}
                      </p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-xs text-muted-foreground">{lote.agricultorNombre}</p>
                      {lote.variedad && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <p className="text-xs text-muted-foreground">
                            {VARIEDAD_PRODUCTO_CONFIG[lote.variedad].label}
                          </p>
                        </>
                      )}
                      <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                        {lote.cajasExportables} exp.
                      </span>
                    </div>

                    {/* Pallet segments – one per row of inputs */}
                    <div className="space-y-3">
                      {filasLote.map((fila, idx) => {
                        const codigoTrazabilidad = getTraceabilityCodeForDate(toLoteForTrazabilidad(lote), fechaEmpaquetado)
                        const palletNorm = fila.numeroPallet.trim() ? normalizarNumeroPallet(fila.numeroPallet) : ''
                        const cajasExistentes = palletNorm ? (palletOcupacion[palletNorm] ?? 0) : 0
                        const cajasOtrasFilas = palletNorm
                          ? filas
                              .filter((f) => f.filaId !== fila.filaId && f.incluir && normalizarNumeroPallet(f.numeroPallet) === palletNorm)
                              .reduce((acc, f) => acc + (parseInt(f.numCajas, 10) || 0), 0)
                          : 0
                        const cajasEsteFila = parseInt(fila.numCajas, 10) || 0
                        const totalEnPallet = cajasExistentes + cajasOtrasFilas + cajasEsteFila
                        const disponibleEnPallet = CAJAS_POR_PALLET - cajasExistentes - cajasOtrasFilas
                        const excedePallet = palletNorm !== '' && cajasEsteFila > 0 && totalEnPallet > CAJAS_POR_PALLET

                        return (
                          <div
                            key={fila.filaId}
                            className={`flex items-start gap-3 ${idx > 0 ? 'border-t border-slate-100 pt-3' : ''}`}
                          >
                            <Checkbox
                              checked={fila.incluir}
                              onCheckedChange={(checked) => actualizarFila(fila.filaId, { incluir: !!checked })}
                              className="mt-2"
                            />
                            <div className="min-w-0 flex-1">
                              {filasLote.length > 1 && (
                                <p className="mb-1.5 text-xs font-semibold text-amber-700">
                                  Pallet {idx + 1} de {filasLote.length}
                                </p>
                              )}
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">N° Pallet</Label>
                                  <Input
                                    placeholder="Ej: 001"
                                    value={fila.numeroPallet}
                                    onChange={(e) => actualizarFila(fila.filaId, { numeroPallet: e.target.value })}
                                    disabled={!fila.incluir}
                                    className={errores[`${fila.filaId}-pallet`] || excedePallet ? 'border-red-400' : ''}
                                  />
                                  {errores[`${fila.filaId}-pallet`] && (
                                    <p className="text-xs text-red-500">{errores[`${fila.filaId}-pallet`]}</p>
                                  )}
                                  {!errores[`${fila.filaId}-pallet`] && palletNorm && fila.incluir && (
                                    <p className={`text-xs ${excedePallet ? 'text-red-500' : disponibleEnPallet <= 20 ? 'text-amber-600' : 'text-slate-400'}`}>
                                      {cajasExistentes > 0
                                        ? `${cajasExistentes} exist. + ${cajasOtrasFilas > 0 ? `${cajasOtrasFilas} otras + ` : ''}${cajasEsteFila} aquí = ${totalEnPallet}/${CAJAS_POR_PALLET}`
                                        : cajasOtrasFilas > 0
                                        ? `${cajasOtrasFilas} otras + ${cajasEsteFila} aquí = ${totalEnPallet}/${CAJAS_POR_PALLET}`
                                        : `${cajasEsteFila} / ${CAJAS_POR_PALLET} · libres: ${disponibleEnPallet}`
                                      }
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">N° Cajas</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={fila.numCajas}
                                    onChange={(e) => actualizarFila(fila.filaId, { numCajas: e.target.value })}
                                    disabled={!fila.incluir}
                                    className={errores[`${fila.filaId}-cajas`] ? 'border-red-400' : ''}
                                  />
                                  {errores[`${fila.filaId}-cajas`] && (
                                    <p className="text-xs text-red-500">{errores[`${fila.filaId}-cajas`]}</p>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Cód. trazabilidad</Label>
                                  <Input
                                    value={codigoTrazabilidad}
                                    disabled
                                    className="bg-muted/40 font-mono text-foreground disabled:opacity-100 disabled:text-foreground"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {(pageActual - 1) * PAGE_SIZE + 1}-{Math.min(pageActual * PAGE_SIZE, lotesFiltradosOrdenados.length)} de {lotesFiltradosOrdenados.length} lotes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageActual <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {pageActual} de {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageActual >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Cajas a repartir</p>
              <p className="mt-1 text-3xl font-bold text-indigo-900">{totalCajasAEmpaquetar}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Agricultores incluidos</p>
              <p className="mt-1 text-3xl font-bold text-amber-900">{agricultoresDistribucion.length}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Empaquetadores activos</p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">{empaquetadoresActivosDetalle.length}</p>
            </div>
          </div>

          <Card className="mb-5">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Empaquetadores que laboraron en el día</p>
                <p className="text-xs text-muted-foreground">
                  Selecciona a los empaquetadores presentes. Las cajas se repartirán automáticamente y de forma equitativa entre todos los seleccionados.
                </p>
              </div>
              {colaboradores.length === 0 ? (
                <p className="rounded-lg border bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay empaquetadores registrados.
                </p>
              ) : (
                <div className="space-y-3">
                  <Popover open={empaquetadorPickerOpen} onOpenChange={setEmpaquetadorPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {empaquetadoresActivosDetalle.length === 0
                              ? 'Seleccionar empaquetadores'
                              : `${empaquetadoresActivosDetalle.length} empaquetador${empaquetadoresActivosDetalle.length !== 1 ? 'es' : ''} seleccionado${empaquetadoresActivosDetalle.length !== 1 ? 's' : ''}`}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {empaquetadoresActivosDetalle.length === 0
                              ? 'Filtra por nombre y marca múltiples opciones.'
                              : empaquetadoresActivosDetalle
                                  .slice(0, 3)
                                  .map((colaborador) => `${colaborador.apellido}, ${colaborador.nombre}`)
                                  .join(' · ')}
                            {empaquetadoresActivosDetalle.length > 3 ? '...' : ''}
                          </p>
                        </div>
                        <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[min(36rem,calc(100vw-2rem))] p-0"
                      onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                      <div className="border-b p-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Filtrar por nombre, código o DNI..."
                            value={empaquetadorSearch}
                            onChange={(e) => setEmpaquetadorSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                        <span>{empaquetadoresFiltrados.length} resultado{empaquetadoresFiltrados.length !== 1 ? 's' : ''}</span>
                        <span>{empaquetadoresActivosDetalle.length} seleccionado{empaquetadoresActivosDetalle.length !== 1 ? 's' : ''}</span>
                      </div>

                      {empaquetadoresFiltrados.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin resultados para el filtro actual.</p>
                      ) : (
                        <div className="max-h-80 overflow-y-auto">
                          {empaquetadoresFiltrados.map((colaborador) => {
                            const activo = empaquetadoresActivos.includes(colaborador.id)
                            return (
                              <label
                                key={colaborador.id}
                                htmlFor={`empaquetador-${colaborador.id}`}
                                className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 ${activo ? 'bg-emerald-50' : 'bg-white'}`}
                              >
                                <Checkbox
                                  id={`empaquetador-${colaborador.id}`}
                                  checked={activo}
                                  onCheckedChange={(checked) => toggleEmpaquetadorActivo(colaborador.id, !!checked)}
                                  className="mt-0.5"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground">{colaborador.apellido}, {colaborador.nombre}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Código {colaborador.codigo}{colaborador.dni ? ` · DNI ${colaborador.dni}` : ''}
                                  </p>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          {empaquetadoresActivosDetalle.length === 0 ? (
            <p className="rounded-lg border bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
              Selecciona al menos un empaquetador para calcular el reparto automático.
            </p>
          ) : agricultoresDistribucion.length === 0 ? (
            <p className="rounded-lg border bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
              No hay agricultores incluidos en el paso anterior.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-foreground">
                  Total editado: <span className="font-semibold">{totalCajasEditadas}</span> / {totalCajasAEmpaquetar} cajas
                </p>
                {existeFormatoCajasInvalido && (
                  <p className="mt-1 text-red-600">Usa solo numeros enteros mayores o iguales a 0.</p>
                )}
                {!existeFormatoCajasInvalido && excedeTotalCajas && (
                  <p className="mt-1 text-red-600">La suma editada excede el total de cajas a repartir.</p>
                )}
                {!existeFormatoCajasInvalido && !excedeTotalCajas && faltanteCajas > 0 && (
                  <p className="mt-1 text-amber-700">Faltan {faltanteCajas} cajas por asignar manualmente. Al confirmar, se completaran automaticamente.</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {empaquetadoresActivosDetalle.map((empaquetador) => (
                  <Card key={empaquetador.id}>
                    <CardContent className="flex items-start justify-between gap-3 p-4">
                      <div>
                        <p className="text-base font-semibold text-foreground">{empaquetador.apellido}, {empaquetador.nombre}</p>
                        <p className="text-xs text-muted-foreground">Participa en el reparto automatico del total del día.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => toggleEmpaquetadorActivo(empaquetador.id, false)}
                        >
                          Quitar
                        </Button>
                      </div>
                      <div className="w-36 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <Label className="text-xs font-medium text-emerald-700">Cajas asignadas</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={cajasAsignadasEditadas[empaquetador.id] ?? '0'}
                          onChange={(event) => actualizarCajasEditadas(empaquetador.id, event.target.value)}
                          className="mt-1 h-9 bg-white"
                        />
                        <p className="mt-1 text-[11px] text-emerald-700">
                          Auto: {cajasSugeridasAutomaticas[empaquetador.id] ?? 0}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {errorGlobal && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGlobal}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filasIncluidas.length}</span> lotes ·
            <span className="ml-1 font-semibold text-foreground">{totalCajasAEmpaquetar}</span> cajas
            {pasoActual === 2 && (
              <>
                <span className="mx-1">·</span>
                <span className="font-semibold text-foreground">{empaquetadoresActivosDetalle.length}</span> empaquetadores
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(ROUTES.EMPAQUETADO_OPERACIONES)} disabled={guardando}>
              Cancelar
            </Button>
            {pasoActual === 2 && (
              <Button variant="outline" onClick={() => setPasoActual(1)} disabled={guardando}>
                Volver al paso 1
              </Button>
            )}
            {pasoActual === 1 ? (
              <Button onClick={handleContinuarPaso2} disabled={guardando || filasIncluidas.length === 0}>
                Continuar a empaquetadores
              </Button>
            ) : (
              <Button onClick={handleConfirmar} disabled={guardando || filasIncluidas.length === 0}>
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar empaquetado
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
