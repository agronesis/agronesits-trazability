import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Filter, Printer, Trash2 } from 'lucide-react'
import { useLotes } from './hooks/useLotes'
import { LoteForm } from './LoteForm'
import { printLoteTicket } from './printLoteTicket'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CALIDAD_PRODUCTO_CONFIG, ESTADO_LOTE_CONFIG, TIPO_PRODUCCION_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { formatFecha, formatPeso } from '@/utils/formatters'
import { calcularPesoPorJaba } from '@/utils/business-rules'
import type { LoteFormData } from '@/utils/validators'
import type { EstadoLote, Lote } from '@/types/models'
import { useAuthStore } from '@/store/auth.store'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'

export default function LotesPage() {
  const { lotes, loading, error, reload, crear, eliminar } = useLotes()
  const navigate = useNavigate()
  const roles = useAuthStore((state) => state.roles)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoLote | 'todos'>('todos')
  const [filtroFechaIngreso, setFiltroFechaIngreso] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [ticketLote, setTicketLote] = useState<Lote | null>(null)
  const [loteAEliminar, setLoteAEliminar] = useState<Lote | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminacion, setErrorEliminacion] = useState<string | null>(null)
  const canCreateLotes = hasPermission(roles, APP_PERMISSIONS.LOTES_CREATE)
  const canDeleteLotes = hasPermission(roles, APP_PERMISSIONS.LOTES_DELETE)
  const canPrintLoteTicket = hasPermission(roles, APP_PERMISSIONS.LOTES_PRINT_TICKET)
  const hasFiltrosActivos = busqueda.trim() !== '' || filtroEstado !== 'todos' || filtroFechaIngreso !== ''

  const getAcopiadorLabel = (lote: Lote) => {
    if (lote.acopiador) return `${lote.acopiador.apellido}, ${lote.acopiador.nombre}`
    if (lote.acopiador_agricultor) return `${lote.acopiador_agricultor.apellido}, ${lote.acopiador_agricultor.nombre}`
    return '-'
  }

  const filtrados = lotes.filter((l) => {
    const coincideBusqueda = `${l.codigo} ${l.agricultor?.nombre ?? ''} ${l.agricultor?.apellido ?? ''} ${l.acopiador?.nombre ?? ''} ${l.acopiador?.apellido ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === 'todos' || l.estado === filtroEstado
    const coincideFechaIngreso = !filtroFechaIngreso || l.fecha_ingreso === filtroFechaIngreso
    return coincideBusqueda && coincideEstado && coincideFechaIngreso
  })

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicio = (paginaSegura - 1) * tamanoPagina
  const fin = inicio + tamanoPagina
  const paginados = filtrados.slice(inicio, fin)

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas)
    }
  }, [paginaActual, totalPaginas])

  const handleSubmit = async (data: LoteFormData) => {
    try {
      const nuevo = await crear(data)
      setDialogError(null)
      setDialogOpen(false)
      setTicketLote(nuevo)
    } catch (e) {
      setDialogError((e as Error).message)
    }
  }

  const handleEliminar = async () => {
    if (!canDeleteLotes || !loteAEliminar) return
    setEliminando(true)
    try {
      await eliminar(loteAEliminar.id)
      setLoteAEliminar(null)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.startsWith('DESPACHO_ASOCIADO::')) {
        const codigos = msg.replace('DESPACHO_ASOCIADO::', '')
        setLoteAEliminar(null)
        setErrorEliminacion(`No se puede eliminar este lote porque tiene despacho(s) asociado(s): ${codigos}. Elimine primero el/los despacho(s) para poder eliminar el lote.`)
      } else {
        setLoteAEliminar(null)
        setErrorEliminacion(msg)
      }
    } finally {
      setEliminando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Lotes"
        description={`${lotes.length} registrados`}
        actions={canCreateLotes ? <Button onClick={() => { setDialogError(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Nuevo lote</Button> : undefined}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código o agricultor..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPaginaActual(1)
            }}
          />
        </div>
        <Select
          value={filtroEstado}
          onValueChange={(v) => {
            setFiltroEstado(v as EstadoLote | 'todos')
            setPaginaActual(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_LOTE_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-full sm:w-48"
          value={filtroFechaIngreso}
          onChange={(e) => {
            setFiltroFechaIngreso(e.target.value)
            setPaginaActual(1)
          }}
        />
        <Select
          value={String(tamanoPagina)}
          onValueChange={(value) => {
            setTamanoPagina(Number(value))
            setPaginaActual(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Tamano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / pag</SelectItem>
            <SelectItem value="20">20 / pag</SelectItem>
            <SelectItem value="50">50 / pag</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setBusqueda('')
            setFiltroEstado('todos')
            setFiltroFechaIngreso('')
            setPaginaActual(1)
          }}
          disabled={!hasFiltrosActivos}
        >
          Limpiar filtros
        </Button>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          title="Sin lotes"
          description="Registra el primer lote del día."
          action={canCreateLotes ? <Button onClick={() => { setDialogError(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Nuevo lote</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {paginados.map((l) => (
            <div
              key={l.id}
              className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/lotes/${l.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{l.codigo}</span>
                  <EstadoLoteBadge estado={l.estado} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {l.agricultor?.apellido}, {l.agricultor?.nombre} · {l.producto?.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.centro_acopio?.nombre} · Ingreso: {formatFecha(l.fecha_ingreso)} · Cosecha: {formatFecha(l.fecha_cosecha)} · N° JABAS: {l.num_cubetas} · Bruto: {formatPeso(l.peso_bruto_kg)} · Tara: {formatPeso(l.peso_tara_kg)} · Neto: {formatPeso(l.peso_neto_kg)} · Peso/jaba: {formatPeso(calcularPesoPorJaba(l.peso_neto_kg, l.num_cubetas))}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {canPrintLoteTicket && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); printLoteTicket(l) }}>
                    <Printer className="h-4 w-4" />
                  </Button>
                )}
                {canDeleteLotes && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setLoteAEliminar(l) }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/lotes/${l.id}`) }}>
                  <Eye className="h-4 w-4 mr-1" /> Ver
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {inicio + 1}-{Math.min(fin, filtrados.length)} de {filtrados.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaSegura === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {paginaSegura} de {totalPaginas}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {canCreateLotes && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar nuevo lote</DialogTitle></DialogHeader>
            {dialogError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{dialogError}</p>}
            <LoteForm onSubmit={handleSubmit} onCancel={() => { setDialogError(null); setDialogOpen(false) }} />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={Boolean(ticketLote)} onOpenChange={(open) => !open && setTicketLote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ticket de confirmación</DialogTitle></DialogHeader>
          {ticketLote && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Agronesis del Perú S.A.C.</CardTitle>
                <p className="text-sm text-muted-foreground">Lote registrado correctamente</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="font-semibold">{ticketLote.codigo}</p>
                </div>
                {ticketLote.codigo_lote_agricultor && (
                  <div>
                    <p className="text-xs text-muted-foreground">Código de lote por agricultor</p>
                    <p className="font-medium">{ticketLote.codigo_lote_agricultor}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Agricultor</p>
                  <p className="font-semibold">{ticketLote.agricultor?.apellido}, {ticketLote.agricultor?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Acopiador</p>
                  <p className="font-semibold">{getAcopiadorLabel(ticketLote)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Producto</p>
                  {ticketLote.producto ? (
                    <div className="space-y-1">
                      <p className="font-medium">{ticketLote.producto.nombre}</p>
                      <p className="text-xs text-muted-foreground">Codigo: {ticketLote.producto.codigo}</p>
                      <p className="text-xs text-muted-foreground">Variedad: {VARIEDAD_PRODUCTO_CONFIG[ticketLote.producto.variedad].label}</p>
                      <p className="text-xs text-muted-foreground">Calidad: {CALIDAD_PRODUCTO_CONFIG[ticketLote.producto.calidad].label}</p>
                      <p className="text-xs text-muted-foreground">Tipo: {TIPO_PRODUCCION_CONFIG[ticketLote.producto.tipo_produccion].label}</p>
                    </div>
                  ) : (
                    <p>-</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Bruto</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_bruto_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tara</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_tara_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Neto</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_neto_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Peso por jaba</p>
                    <p className="font-medium">{formatPeso(calcularPesoPorJaba(ticketLote.peso_neto_kg, ticketLote.num_cubetas))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Jabas ingresadas</p>
                    <p className="font-medium">{ticketLote.num_cubetas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha ingreso</p>
                    <p className="font-medium">{formatFecha(ticketLote.fecha_ingreso)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha cosecha</p>
                    <p className="font-medium">{formatFecha(ticketLote.fecha_cosecha)}</p>
                  </div>
                </div>
                {ticketLote.jabas_prestadas > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Jabas prestadas (por devolver)</p>
                    <p className="font-medium">{ticketLote.jabas_prestadas}</p>
                  </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                  <Button type="button" variant="outline" className="w-full" onClick={() => setTicketLote(null)}>
                    Cerrar
                  </Button>
                  {canPrintLoteTicket && (
                    <Button type="button" variant="secondary" className="w-full" onClick={() => printLoteTicket(ticketLote)}>
                      <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                  )}
                  <Button type="button" className="w-full" onClick={() => {
                    const loteId = ticketLote.id
                    setTicketLote(null)
                    navigate(`/lotes/${loteId}`)
                  }}>
                    Ver lote
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
      {canDeleteLotes && (
        <ConfirmDialog
          open={Boolean(loteAEliminar)}
          title="Eliminar lote"
          description={`¿Está seguro que desea eliminar el lote ${loteAEliminar?.codigo ?? ''}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="destructive"
          loading={eliminando}
          onConfirm={handleEliminar}
          onCancel={() => setLoteAEliminar(null)}
        />
      )}

      <Dialog open={Boolean(errorEliminacion)} onOpenChange={(open) => { if (!open) setErrorEliminacion(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>No se puede eliminar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{errorEliminacion}</p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setErrorEliminacion(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
