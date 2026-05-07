import { useEffect, useState } from 'react'
import { CalendarDays, Filter, Search } from 'lucide-react'
import { getAuditLogs, type AuditLog } from '@/services/audit.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ACCION_CONFIG: Record<string, { label: string; className: string }> = {
  crear:      { label: 'Creación',    className: 'bg-green-100 text-green-800' },
  actualizar: { label: 'Edición',     className: 'bg-blue-100 text-blue-800' },
  eliminar:   { label: 'Eliminación', className: 'bg-red-100 text-red-800' },
}

const MODULOS = [
  { value: 'all',                label: 'Todos los módulos' },
  { value: 'lotes',              label: 'Lotes' },
  { value: 'agricultores',       label: 'Agricultores' },
  { value: 'acopiadores',        label: 'Acopiadores' },
  { value: 'colaboradores',      label: 'Colaboradores' },
  { value: 'productos',          label: 'Productos' },
  { value: 'centros_acopio',     label: 'Centros de Acopio' },
  { value: 'config_parametros',  label: 'Parámetros del Sistema' },
  { value: 'config_precios',     label: 'Precios del Sistema' },
  { value: 'liquidaciones_agri', label: 'Liquidaciones – Agricultores' },
  { value: 'planillas_quincenales', label: 'Planillas Quincenales' },
]

const PAGE_SIZE = 10

function getAccionDisplay(log: AuditLog): { label: string; className: string } {
  const descripcion = log.descripcion.toLowerCase()

  if (log.modulo === 'lotes') {
    if (descripcion.includes('liquidado')) {
      return { label: 'Liquidado', className: 'bg-emerald-100 text-emerald-800' }
    }
    if (descripcion.includes('despachado')) {
      return { label: 'Despachado', className: 'bg-orange-100 text-orange-800' }
    }
    if (descripcion.includes('empaquetado')) {
      return { label: 'Empaquetado', className: 'bg-indigo-100 text-indigo-800' }
    }
    if (descripcion.includes('clasificado')) {
      return { label: 'Clasificado', className: 'bg-blue-100 text-blue-800' }
    }
    if (descripcion.includes('creado') || log.accion === 'crear') {
      return { label: 'Creado', className: 'bg-green-100 text-green-800' }
    }
    if (descripcion.includes('eliminado') || log.accion === 'eliminar') {
      return { label: 'Eliminado', className: 'bg-red-100 text-red-800' }
    }
  }

  if (['liquidaciones_agri', 'planillas_quincenales'].includes(log.modulo)) {
    if (log.accion === 'eliminar') {
      return { label: 'Borrador Eliminado', className: 'bg-red-100 text-red-800' }
    }
    if (descripcion.includes('liquidada') || descripcion.includes('pagada')) {
      return { label: 'Liquidado', className: 'bg-emerald-100 text-emerald-800' }
    }
    if (descripcion.includes('confirmada') || descripcion.includes('aceptada')) {
      return { label: 'Borrador Aceptado', className: 'bg-amber-100 text-amber-800' }
    }
    if (log.accion === 'actualizar') {
      return { label: 'Borrador Editado', className: 'bg-blue-100 text-blue-800' }
    }
    if (log.accion === 'crear') {
      return { label: 'Borrador Creado', className: 'bg-green-100 text-green-800' }
    }
  }

  return ACCION_CONFIG[log.accion] ?? { label: log.accion, className: 'bg-gray-100 text-gray-700' }
}

function formatFechaHora(fechaIso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(fechaIso))
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modulo, setModulo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const hoy = new Date().toISOString().split('T')[0]
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [desde, setDesde] = useState(hace30)
  const [hasta, setHasta] = useState(hoy)

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      const moduloFiltro = modulo === 'all' ? undefined : modulo
      const data = await getAuditLogs({ modulo: moduloFiltro, desde, hasta })
      setLogs(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void cargar() }, [modulo, desde, hasta])

  const filtrados = logs.filter((l) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return l.user_email.toLowerCase().includes(q) || l.descripcion.toLowerCase().includes(q)
  })

  useEffect(() => {
    setPagina(1)
  }, [modulo, desde, hasta, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * PAGE_SIZE
  const fin = inicio + PAGE_SIZE
  const logsPaginados = filtrados.slice(inicio, fin)

  return (
    <div>
      <PageHeader
        title="Logs de Auditoría"
        description="Historial de acciones realizadas por usuarios en el sistema"
      />

      {/* Filtros */}
      <div className="mb-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_380px_minmax(280px,1fr)]">
          <Select value={modulo} onValueChange={setModulo}>
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              {MODULOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-9 w-[150px] border-0 px-2 pr-8 shadow-none focus-visible:ring-0"
            />
            <span className="text-muted-foreground text-sm">a</span>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="h-9 w-[150px] border-0 px-2 pr-8 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="relative min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-11 bg-background pl-9"
              placeholder="Buscar por usuario o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingPage />
      ) : error ? (
        <ErrorMessage message={error} onRetry={cargar} />
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Sin registros para los filtros seleccionados.
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fecha y hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsPaginados.map((log) => {
                  const accionCfg = getAccionDisplay(log)
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatFechaHora(log.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">{log.user_email}</TableCell>
                      <TableCell className="text-sm capitalize">{log.modulo}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${accionCfg.className}`}>
                          {accionCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{log.descripcion}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {filtrados.length === 0 ? 0 : inicio + 1}-{Math.min(fin, filtrados.length)} de {filtrados.length} registros
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={paginaActual <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-1">
                Página {paginaActual} de {totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
