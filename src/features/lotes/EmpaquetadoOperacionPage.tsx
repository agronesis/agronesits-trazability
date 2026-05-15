import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { PackageCheck, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROUTES, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { CLAVE_PESO_CAJA_EXPORTACION, getValorNumericoSistema } from '@/services/config-precios.service'
import { getLotesEmpaquetadoOperacion, type LoteEmpaquetadoOperacionRow } from '@/services/lotes.service'
import { calcularCajasExportables, DEFAULT_PESO_CAJA_EXPORTACION_KG } from '@/utils/business-rules'
import { formatFecha } from '@/utils/formatters'
import type { VariedadProducto } from '@/types/models'

type FiltroVariedad = VariedadProducto | 'todos'

const PAGE_SIZE = 20

export type LoteEmpaquetadoResumen = {
  loteId: string
  codigo: string
  codigoAgricultor: string | null
  sublote: string | null
  fechaIngreso: string
  estado: LoteEmpaquetadoOperacionRow['estado']
  agricultorNombre: string
  variedad: VariedadProducto | null
  cajasExportables: number   // proyección desde clasificaciones
  cajasExportadas: number    // cajas realmente empaquetadas
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
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [filtroVariedad, setFiltroVariedad] = useState<FiltroVariedad>('todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<LoteEmpaquetadoOperacionRow[]>([])
  const [pesoCajaExportacionKg, setPesoCajaExportacionKg] = useState(DEFAULT_PESO_CAJA_EXPORTACION_KG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    const cargar = async () => {
      setLoading(true)
      setError(null)
      try {
        const [data, pesoCajaConfigurado] = await Promise.all([
          getLotesEmpaquetadoOperacion(fecha),
          getValorNumericoSistema(CLAVE_PESO_CAJA_EXPORTACION, DEFAULT_PESO_CAJA_EXPORTACION_KG),
        ])
        if (!active) return
        setRows(data)
        setPesoCajaExportacionKg(pesoCajaConfigurado)
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
      const pesoBuenoKg = normalizarArray(row.clasificaciones).reduce(
        (acc, item) => acc + (item.peso_bueno_kg ?? 0),
        0
      )
      const cajasExportadas = normalizarArray(row.empaquetados).reduce(
        (acc, item) => acc + (item.num_cajas ?? 0),
        0
      )

      return {
        loteId: row.id,
        codigo: row.codigo,
        codigoAgricultor: row.codigo_lote_agricultor,
        sublote: row.sublote,
        fechaIngreso: row.fecha_ingreso,
        estado: row.estado,
        agricultorNombre: getNombreAgricultor(row),
        variedad: row.producto?.variedad ?? null,
        cajasExportables: calcularCajasExportables(pesoBuenoKg, pesoCajaExportacionKg),
        cajasExportadas,
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

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={() => setReloadKey((current) => current + 1)} />

  const clasificadosDelDia = lotesAgrupados.filter((l) => l.estado === 'clasificado')

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Empaquetado"
        description="Listado diario de lotes para empaquetado"
        actions={
          <Button
            disabled={clasificadosDelDia.length === 0}
            onClick={() => navigate(ROUTES.EMPAQUETAR_DIA.replace(':fecha', fecha))}
          >
            <PackageCheck className="h-4 w-4" />
            Empaquetar día
          </Button>
        }
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
          title="Sin lotes para ese día"
          description={`No hay lotes registrados para ${formatFecha(fecha)}${filtroVariedad !== 'todos' ? ` en ${VARIEDAD_PRODUCTO_CONFIG[filtroVariedad].label}` : ''}.`}
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
                {lotesPagina.map((item) => (
                  <div
                    key={item.loteId}
                    className="w-full text-left"
                  >
                    <Card>
                      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">{item.codigoAgricultor ?? item.codigo}{item.sublote ? ` - ${item.sublote}` : ''}</p>
                            <EstadoLoteBadge estado={item.estado} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{item.agricultorNombre}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.variedad ? VARIEDAD_PRODUCTO_CONFIG[item.variedad].label : 'Sin variedad'} · Ingreso {formatFecha(item.fechaIngreso)}
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
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
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
    </div>
  )
}