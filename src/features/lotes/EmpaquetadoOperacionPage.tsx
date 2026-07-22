import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Printer, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { CLAVE_PESO_CAJA_EXPORTACION, getValorNumericoSistema } from '@/services/config-precios.service'
import { getLotesEmpaquetadoOperacion, updateLote, type LoteEmpaquetadoOperacionRow } from '@/services/lotes.service'
import { createEmpaquetado, getResumenPalletsEmpaquetado } from '@/services/empaquetados.service'
import { useAuthStore } from '@/store/auth.store'
import { calcularCajasExportables, CAJAS_POR_PALLET, DEFAULT_PESO_CAJA_EXPORTACION_KG, normalizarNumeroPallet } from '@/utils/business-rules'
import { formatFecha } from '@/utils/formatters'
import { getTraceabilityCodeForDate, openPrintWindow, writeTraceabilityLabelCopies } from './printDespachoLabel'
import type { DestinoEmpaquetado, Lote, VariedadProducto } from '@/types/models'

type FiltroVariedad = VariedadProducto | 'todos'

const PAGE_SIZE = 20

export type LoteEmpaquetadoResumen = {
  loteId: string
  codigo: string
  codigoAgricultor: string | null
  sublote: string | null
  fechaIngreso: string
  fechaClasificacion: string | null
  fechaCosecha: string
  agricultorNombreOriginal: string | null
  agricultorApellido: string | null
  estado: LoteEmpaquetadoOperacionRow['estado']
  agricultorNombre: string
  variedad: VariedadProducto | null
  cajasExportables: number   // proyección desde clasificaciones
  cajasExportadas: number    // cajas realmente empaquetadas
  palletPreasignado: string | null
  cajasPreasignadas: number | null
  despachoPreasignado: string | null
}

function toLoteForTrazabilidad(item: LoteEmpaquetadoResumen): Lote {
  return {
    id: item.loteId,
    codigo: item.codigo,
    codigo_lote_agricultor: item.codigoAgricultor,
    fecha_cosecha: item.fechaCosecha,
    agricultor: item.agricultorNombreOriginal
      ? { nombre: item.agricultorNombreOriginal, apellido: item.agricultorApellido ?? '' }
      : null,
    producto: item.variedad ? { variedad: item.variedad } : null,
  } as unknown as Lote
}

function normalizarArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return [value]
  return []
}

function getNombreAgricultor(row: LoteEmpaquetadoOperacionRow): string {
  const agricultor = row.agricultor
  if (!agricultor) return 'Sin agricultor'
  return `${agricultor.apellido}, ${agricultor.nombre}`
}

export default function EmpaquetadoOperacionPage() {
  const { user } = useAuthStore()
  const [fecha, setFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [filtroVariedad, setFiltroVariedad] = useState<FiltroVariedad>('todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<LoteEmpaquetadoOperacionRow[]>([])
  const [pesoCajaExportacionKg, setPesoCajaExportacionKg] = useState(DEFAULT_PESO_CAJA_EXPORTACION_KG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [palletOcupacion, setPalletOcupacion] = useState<Record<string, number>>({})

  // Modal de pre-asignación de pallet por lote
  const [loteAsignar, setLoteAsignar] = useState<LoteEmpaquetadoResumen | null>(null)
  const [formPallet, setFormPallet] = useState('')
  const [formCajas, setFormCajas] = useState('')
  const [formDespacho, setFormDespacho] = useState('')
  const [formDestino, setFormDestino] = useState<DestinoEmpaquetado>('europa')
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false)
  const [errorAsignacion, setErrorAsignacion] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const cargar = async () => {
      setLoading(true)
      setError(null)
      try {
        const [data, pesoCajaConfigurado, pallets] = await Promise.all([
          getLotesEmpaquetadoOperacion(fecha),
          getValorNumericoSistema(CLAVE_PESO_CAJA_EXPORTACION, DEFAULT_PESO_CAJA_EXPORTACION_KG),
          getResumenPalletsEmpaquetado(),
        ])
        if (!active) return
        setRows(data)
        setPesoCajaExportacionKg(pesoCajaConfigurado)
        setPalletOcupacion(pallets)
      } catch (e) {
        if (!active) return
        setError((e as Error).message)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void cargar()

    return () => {
      active = false
    }
  }, [fecha, reloadKey])

  const lotesAgrupados = useMemo<LoteEmpaquetadoResumen[]>(() => {
    return rows.map((row) => {
      const clasificaciones = normalizarArray(row.clasificaciones)
      const pesoBuenoKg = clasificaciones.reduce(
        (acc, item) => acc + (item.peso_bueno_kg ?? 0),
        0
      )
      const cajasEmpaquetadas = normalizarArray(row.empaquetados).reduce(
        (acc, item) => acc + (item.num_cajas ?? 0),
        0
      )
      // Exportadas: cajas realmente empaquetadas; si aún no hay registros de
      // empaquetado, la asignación de pallet cuenta como cajas exportadas.
      const cajasExportadas = cajasEmpaquetadas > 0 ? cajasEmpaquetadas : (row.cajas_preasignadas ?? 0)

      return {
        loteId: row.id,
        codigo: row.codigo,
        codigoAgricultor: row.codigo_lote_agricultor,
        sublote: row.sublote,
        fechaIngreso: row.fecha_ingreso,
        fechaClasificacion: clasificaciones[0]?.fecha_clasificacion ?? null,
        fechaCosecha: row.fecha_cosecha,
        agricultorNombreOriginal: row.agricultor?.nombre ?? null,
        agricultorApellido: row.agricultor?.apellido ?? null,
        estado: row.estado,
        agricultorNombre: getNombreAgricultor(row),
        variedad: row.producto?.variedad ?? null,
        cajasExportables: calcularCajasExportables(pesoBuenoKg, pesoCajaExportacionKg),
        cajasExportadas,
        palletPreasignado: row.pallet_preasignado,
        cajasPreasignadas: row.cajas_preasignadas,
        despachoPreasignado: row.despacho_preasignado,
      }
    }).sort((a, b) => {
      if (b.cajasExportables !== a.cajasExportables) return b.cajasExportables - a.cajasExportables
      return a.codigo.localeCompare(b.codigo)
    })
  }, [pesoCajaExportacionKg, rows])

  const lotesPorVariedad = useMemo(() => {
    if (filtroVariedad === 'todos') return lotesAgrupados
    return lotesAgrupados.filter((item) => item.variedad === filtroVariedad)
  }, [filtroVariedad, lotesAgrupados])

  const lotesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lotesPorVariedad
    return lotesPorVariedad.filter((item) => {
      const codigoVisible = `${item.codigoAgricultor ?? item.codigo}${item.sublote ? ` - ${item.sublote}` : ''}`.toLowerCase()
      return (
        codigoVisible.includes(q) ||
        item.agricultorNombre.toLowerCase().includes(q)
      )
    })
  }, [lotesPorVariedad, search])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filtroVariedad, search, fecha])

  const totalPages = Math.max(1, Math.ceil(lotesFiltrados.length / PAGE_SIZE))
  const pageActual = Math.min(page, totalPages)
  const lotesPagina = useMemo(
    () => lotesFiltrados.slice((pageActual - 1) * PAGE_SIZE, pageActual * PAGE_SIZE),
    [lotesFiltrados, pageActual]
  )

  // Resumen: refleja el filtro de variedad pero NO la búsqueda (la búsqueda solo afecta la lista)
  const resumen = useMemo(() => {
    return lotesPorVariedad.reduce(
      (acc, item) => {
        acc.totalCajasExportadas += item.cajasExportadas
        if (item.variedad === 'sugar') acc.totalSugar += item.cajasExportadas
        if (item.variedad === 'snow_peas') acc.totalSnow += item.cajasExportadas
        return acc
      },
      { totalCajasExportadas: 0, totalSugar: 0, totalSnow: 0 }
    )
  }, [lotesPorVariedad])

  function abrirAsignacion(item: LoteEmpaquetadoResumen) {
    setLoteAsignar(item)
    setFormPallet(item.palletPreasignado ?? '')
    setFormCajas(item.cajasPreasignadas != null ? String(item.cajasPreasignadas) : String(item.cajasExportables))
    setFormDespacho(item.despachoPreasignado ?? '')
    setFormDestino('europa')
    setErrorAsignacion(null)
  }

  function cerrarAsignacion() {
    if (guardandoAsignacion) return
    setLoteAsignar(null)
    setErrorAsignacion(null)
  }

  /**
   * Cajas pre-asignadas al pallet por lotes que aún NO tienen registros de
   * empaquetado (asignaciones legadas): no están en `palletOcupacion` (que se
   * calcula desde la tabla empaquetados), así que se suman aparte.
   * Las asignaciones nuevas sí crean su registro y ya cuentan en la ocupación.
   */
  function cajasPreasignadasSinEmpaque(palletNorm: string, excluirLoteId?: string): number {
    return rows
      .filter((row) =>
        row.id !== excluirLoteId &&
        normalizarArray(row.empaquetados).length === 0 &&
        normalizarNumeroPallet(row.pallet_preasignado ?? '') === palletNorm
      )
      .reduce((acc, row) => acc + (row.cajas_preasignadas ?? 0), 0)
  }

  async function guardarAsignacion() {
    if (!loteAsignar || !user) return
    // Una asignación registrada es de solo lectura: no se edita ni borra desde el front.
    if (loteAsignar.palletPreasignado) return

    const palletNorm = normalizarNumeroPallet(formPallet)
    if (!palletNorm) {
      setErrorAsignacion('Ingresa un número de pallet válido.')
      return
    }

    const cajas = parseInt(formCajas, 10)
    if (isNaN(cajas) || cajas <= 0) {
      setErrorAsignacion('La cantidad de cajas debe ser mayor a 0.')
      return
    }

    const cajasExistentes = (palletOcupacion[palletNorm] ?? 0) + cajasPreasignadasSinEmpaque(palletNorm, loteAsignar.loteId)
    const totalEnPallet = cajasExistentes + cajas

    if (totalEnPallet > CAJAS_POR_PALLET) {
      setErrorAsignacion(`El pallet ${palletNorm} quedaría con ${totalEnPallet} cajas y excede el máximo de ${CAJAS_POR_PALLET}.`)
      return
    }

    const despacho = formDespacho.trim() || null

    setGuardandoAsignacion(true)
    setErrorAsignacion(null)
    try {
      const codigoTrazabilidad = getTraceabilityCodeForDate(toLoteForTrazabilidad(loteAsignar), fecha)

      // La asignación ES el empaquetado: registro real + cambio de estado del lote.
      await createEmpaquetado(
        {
          lote_id: loteAsignar.loteId,
          colaborador_id: null,
          fecha_empaquetado: fecha,
          destino: formDestino,
          codigo_trazabilidad: codigoTrazabilidad,
          numero_pallet: palletNorm,
          num_cajas: cajas,
          observaciones: null,
        },
        user.id
      )
      await updateLote(loteAsignar.loteId, {
        estado: 'empaquetado',
        pallet_preasignado: palletNorm,
        cajas_preasignadas: cajas,
        despacho_preasignado: despacho,
      })

      setRows((prev) =>
        prev.map((row) =>
          row.id === loteAsignar.loteId
            ? {
                ...row,
                estado: 'empaquetado',
                pallet_preasignado: palletNorm,
                cajas_preasignadas: cajas,
                despacho_preasignado: despacho,
                empaquetados: [...normalizarArray(row.empaquetados), { num_cajas: cajas }],
              }
            : row
        )
      )
      setPalletOcupacion((prev) => ({ ...prev, [palletNorm]: (prev[palletNorm] ?? 0) + cajas }))
      setLoteAsignar(null)
    } catch (e) {
      setErrorAsignacion((e as Error).message)
    } finally {
      setGuardandoAsignacion(false)
    }
  }

  /** Imprime 1 etiqueta por caja para un lote ya asignado (reimprimible desde la lista). */
  function imprimirEtiquetas(item: LoteEmpaquetadoResumen) {
    const copias = item.cajasPreasignadas ?? item.cajasExportables
    if (copias <= 0) return
    const printWindow = openPrintWindow()
    if (!printWindow) return
    const loteTrazabilidad = toLoteForTrazabilidad(item)
    const codigo = getTraceabilityCodeForDate(loteTrazabilidad, fecha)
    writeTraceabilityLabelCopies(printWindow, loteTrazabilidad, codigo, copias)
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={() => setReloadKey((current) => current + 1)} />

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Empaquetado"
        description="Listado diario de lotes para empaquetado"
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          type="date"
          className="w-full sm:w-52"
          value={fecha}
          onChange={(event) => setFecha(event.target.value)}
        />
        <Select value={filtroVariedad} onValueChange={(value) => setFiltroVariedad(value as FiltroVariedad)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todas las variedades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las variedades</SelectItem>
            <SelectItem value="sugar">Sugar Snap</SelectItem>
            <SelectItem value="snow_peas">Snow Peas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="pt-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Cajas exportadas</p>
            <p className="mt-2 text-3xl font-bold text-indigo-900">{resumen.totalCajasExportadas}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Sugar exportadas</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">{resumen.totalSugar}</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50">
          <CardContent className="pt-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Snow exportadas</p>
            <p className="mt-2 text-3xl font-bold text-sky-900">{resumen.totalSnow}</p>
          </CardContent>
        </Card>
      </div>

      {lotesPorVariedad.length === 0 ? (
        <EmptyState
          title="Sin lotes clasificados ese día"
          description={`No hay lotes clasificados el ${formatFecha(fecha)}${filtroVariedad !== 'todos' ? ` en ${VARIEDAD_PRODUCTO_CONFIG[filtroVariedad].label}` : ''}.`}
        />
      ) : (
        <>
          {/* Búsqueda — debajo de los filtros y resumen, antes de los lotes */}
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
            <p className="text-xs text-muted-foreground">
              {lotesFiltrados.length} lote{lotesFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>

          {lotesFiltrados.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="No se encontraron lotes con ese criterio de búsqueda."
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {lotesPagina.map((item) => {
                  const asignable = item.estado === 'clasificado' && !item.palletPreasignado
                  // Los ya asignados se pueden abrir en modo solo lectura (ver/imprimir)
                  const abrible = asignable || !!item.palletPreasignado
                  return (
                    <div
                      key={item.loteId}
                      role={abrible ? 'button' : undefined}
                      tabIndex={abrible ? 0 : undefined}
                      onClick={abrible ? () => abrirAsignacion(item) : undefined}
                      onKeyDown={abrible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirAsignacion(item) } } : undefined}
                      className={`w-full text-left ${abrible ? 'cursor-pointer' : ''}`}
                    >
                      <Card className={abrible ? 'transition-colors hover:border-indigo-300 hover:bg-indigo-50/30' : ''}>
                        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">{item.codigoAgricultor ?? item.codigo}{item.sublote ? ` - ${item.sublote}` : ''}</p>
                              <EstadoLoteBadge estado={item.estado} />
                              {item.palletPreasignado ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                  Pallet {item.palletPreasignado} · {item.cajasPreasignadas ?? 0} cajas
                                  {item.despachoPreasignado ? ` · Desp. ${item.despachoPreasignado}` : ''}
                                </span>
                              ) : asignable ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                  Sin asignar
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{item.agricultorNombre}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.variedad ? VARIEDAD_PRODUCTO_CONFIG[item.variedad].label : 'Sin variedad'} · Ingreso {formatFecha(item.fechaIngreso)}
                              {item.fechaClasificacion ? ` · Clasificado ${formatFecha(item.fechaClasificacion)}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3 lg:justify-end">
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-center">
                              <p className="text-xs font-medium text-indigo-700">Exportables</p>
                              <p className="text-xl font-bold text-indigo-900">{item.cajasExportables}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center">
                              <p className="text-xs font-medium text-emerald-700">Exportadas</p>
                              <p className="text-xl font-bold text-emerald-900">{item.cajasExportadas}</p>
                            </div>
                            {item.palletPreasignado && (
                              <Button
                                variant="outline"
                                size="icon"
                                title="Imprimir etiquetas"
                                onClick={(e) => { e.stopPropagation(); imprimirEtiquetas(item) }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {(pageActual - 1) * PAGE_SIZE + 1}-{Math.min(pageActual * PAGE_SIZE, lotesFiltrados.length)} de {lotesFiltrados.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pageActual <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {pageActual} de {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={pageActual >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Dialog open={!!loteAsignar} onOpenChange={(open) => { if (!open) cerrarAsignacion() }}>
        <DialogContent>
          {loteAsignar && (() => {
            const yaAsignado = !!loteAsignar.palletPreasignado
            const palletNorm = normalizarNumeroPallet(formPallet)
            const cajas = parseInt(formCajas, 10) || 0
            const cajasExistentes = palletNorm
              ? (palletOcupacion[palletNorm] ?? 0) + cajasPreasignadasSinEmpaque(palletNorm, loteAsignar.loteId)
              : 0
            const totalEnPallet = cajasExistentes + cajas
            const disponible = CAJAS_POR_PALLET - cajasExistentes
            const excede = !yaAsignado && palletNorm !== '' && cajas > 0 && totalEnPallet > CAJAS_POR_PALLET
            const codigoTrazabilidad = getTraceabilityCodeForDate(toLoteForTrazabilidad(loteAsignar), fecha)

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {yaAsignado ? 'Pallet asignado' : 'Asignar pallet'} — {loteAsignar.codigoAgricultor ?? loteAsignar.codigo}{loteAsignar.sublote ? ` - ${loteAsignar.sublote}` : ''}
                  </DialogTitle>
                  <DialogDescription>
                    {loteAsignar.agricultorNombre} · {loteAsignar.cajasExportables} cajas exportables
                    {yaAsignado ? ' · Asignación registrada: solo lectura' : ''}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">N° Pallet</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="Ej: 001"
                      value={formPallet}
                      onChange={(e) => { setFormPallet(e.target.value); setErrorAsignacion(null) }}
                      disabled={yaAsignado}
                      className={excede ? 'border-red-400' : ''}
                    />
                    {!yaAsignado && palletNorm && (
                      <p className={`text-xs ${excede ? 'text-red-500' : disponible <= 20 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {cajasExistentes > 0
                          ? `${cajasExistentes} exist. + ${cajas} aquí = ${totalEnPallet}/${CAJAS_POR_PALLET}`
                          : `${cajas} / ${CAJAS_POR_PALLET} · libres: ${Math.max(0, disponible - cajas)}`}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° Cajas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={CAJAS_POR_PALLET}
                      value={formCajas}
                      onChange={(e) => { setFormCajas(e.target.value); setErrorAsignacion(null) }}
                      disabled={yaAsignado}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° Despacho</Label>
                    <Input
                      placeholder="Ej: 045"
                      value={formDespacho}
                      onChange={(e) => { setFormDespacho(e.target.value); setErrorAsignacion(null) }}
                      disabled={yaAsignado}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Destino</Label>
                    <Select
                      value={formDestino}
                      onValueChange={(value) => setFormDestino(value as DestinoEmpaquetado)}
                      disabled={yaAsignado}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="europa">Europa</SelectItem>
                        <SelectItem value="usa">USA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Cód. trazabilidad</Label>
                    <Input
                      value={codigoTrazabilidad}
                      disabled
                      className="bg-muted/40 font-mono text-foreground disabled:opacity-100 disabled:text-foreground"
                    />
                  </div>
                </div>

                {errorAsignacion && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorAsignacion}</p>
                )}

                <DialogFooter className="gap-2">
                  {yaAsignado && (
                    <Button variant="outline" onClick={() => imprimirEtiquetas(loteAsignar)}>
                      <Printer className="h-4 w-4" />
                      Imprimir etiquetas
                    </Button>
                  )}
                  <Button variant="outline" onClick={cerrarAsignacion} disabled={guardandoAsignacion}>
                    {yaAsignado ? 'Cerrar' : 'Cancelar'}
                  </Button>
                  {!yaAsignado && (
                    <Button onClick={guardarAsignacion} disabled={guardandoAsignacion}>
                      {guardandoAsignacion ? 'Guardando...' : 'Guardar asignación'}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}