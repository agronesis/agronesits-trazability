import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLiquidacionesAgri, getLiquidacionAgri, actualizarEstadoLiquidacionAgri, pagarLiquidacionAgri, deleteLiquidacionAgri } from '@/services/liquidaciones-agri.service'
import { logAudit } from '@/services/audit.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RegistrarPagoDialog, type RegistroPagoPayload } from '@/components/shared/RegistrarPagoDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { generateLiquidacionesAgriConsolidadoExcel } from '@/utils/liquidacion-agri-excel'
import { Plus, FileText, Search, Download, Pencil, Trash2 } from 'lucide-react'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth.store'
import { APP_ROLES } from '@/types/auth'
import type { LiquidacionAgri } from '@/types/models'

export default function LiquidacionesAgriPage() {
  const navigate = useNavigate()
  const { roles, user } = useAuthStore()
  const puedePagar = hasPermission(roles, APP_PERMISSIONS.LIQUIDACIONES_AGRI_PAY)
  const esTesoreria = roles.includes(APP_ROLES.TESORERIA)
  const puedeDescargar = esTesoreria || roles.includes(APP_ROLES.ADMIN) || roles.includes(APP_ROLES.GERENCIA)
  
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionAgri[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<{ id: string; estado: 'confirmada' } | null>(null)
  const [pagoPendienteId, setPagoPendienteId] = useState<string | null>(null)
  const [descargandoConsolidado, setDescargandoConsolidado] = useState(false)
  const [eliminarPendienteId, setEliminarPendienteId] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState(false)
  const [fechaDesde, setFechaDesde] = useState(() => getInicioSemanaLaboralISO())
  const [fechaHasta, setFechaHasta] = useState(() => getFinSemanaLaboralISO())
  const [pagina, setPagina] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await getLiquidacionesAgri()
      setLiquidaciones(data)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  const handleCambiarEstado = async () => {
    if (!accionPendiente || !user) return
    setCambiando(true)
    try {
      const liq = liquidaciones.find(l => l.id === accionPendiente.id)
      await actualizarEstadoLiquidacionAgri(accionPendiente.id, accionPendiente.estado)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: accionPendiente.id,
        descripcion: `Liquidación confirmada: ${liq?.codigo}`,
        datosAnteriores: { estado: 'borrador' },
        datosNuevos: { estado: accionPendiente.estado },
      })
      await cargar()
      setAccionPendiente(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  const handleRegistrarPago = async (payload: RegistroPagoPayload) => {
    if (!pagoPendienteId || !user) return
    setCambiando(true)
    try {
      const full = await getLiquidacionAgri(pagoPendienteId)
      const liq = liquidaciones.find((l) => l.id === pagoPendienteId)
      await pagarLiquidacionAgri(pagoPendienteId, payload)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: pagoPendienteId,
        descripcion: `Liquidación liquidada: ${liq?.codigo}`,
        datosAnteriores: { estado: 'confirmada' },
        datosNuevos: { estado: 'pagada', fecha_pago: payload.fecha_pago },
      })

      const lotes = full.detalles ?? []
      for (const detalle of lotes) {
        const loteCodigo = detalle.lote?.codigo ?? detalle.lote_id
        void logAudit({
          userId: user.id,
          userEmail: user.email ?? '',
          accion: 'actualizar',
          modulo: 'lotes',
          registroId: detalle.lote_id,
          descripcion: `Lote liquidado: ${loteCodigo}`,
          datosAnteriores: { estado: 'despachado' },
          datosNuevos: { estado: 'liquidado' },
        })
      }

      await cargar()
      setPagoPendienteId(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  const handleDescargarConsolidado = () => {
    if (!fechaDesde || !fechaHasta) return
    if (fechaDesde > fechaHasta) {
      window.alert('El rango de fechas es invalido: "Desde" no puede ser mayor a "Hasta".')
      return
    }

    setDescargandoConsolidado(true)
    try {
      const enRango = liquidaciones.filter((l) =>
        l.estado === 'pagada' && l.fecha_inicio <= fechaHasta && l.fecha_fin >= fechaDesde
      )

      if (enRango.length === 0) {
        window.alert('No hay liquidaciones liquidadas en el rango de fechas seleccionado.')
        return
      }

      generateLiquidacionesAgriConsolidadoExcel({
        fechaDesde,
        fechaHasta,
        liquidaciones: enRango,
      })
    } finally {
      setDescargandoConsolidado(false)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!user) return
    setCambiando(true)
    try {
      const liq = liquidaciones.find(l => l.id === id)
      await deleteLiquidacionAgri(id)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'eliminar',
        modulo: 'liquidaciones_agri',
        registroId: id,
        descripcion: `Liquidación eliminada: ${liq?.codigo}`,
        datosAnteriores: { codigo: liq?.codigo, total_monto: liq?.total_monto },
        datosNuevos: null,
      })
      await cargar()
      setEliminarPendienteId(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = liquidaciones.filter((l) => {
    if (esTesoreria && !['confirmada', 'pagada'].includes(l.estado)) return false

    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return l.codigo?.toLowerCase().includes(q) ||
      (l.agricultor as any)?.apellido?.toLowerCase().includes(q) ||
      (l.agricultor as any)?.nombre?.toLowerCase().includes(q)
  })

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / itemsPorPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaActual - 1) * itemsPorPagina
  const finPagina = inicioPagina + itemsPorPagina
  const filtradasPaginadas = filtradas.slice(inicioPagina, finPagina)

  useEffect(() => {
    setPagina(1)
  }, [busqueda, itemsPorPagina])

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas)
    }
  }, [pagina, totalPaginas])

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  return (
    <div>
      <PageHeader
        title="Liquidaciones – Agricultores"
        description="Liquidaciones de producción de los agricultores"
        actions={
          <Button onClick={() => navigate('/liquidaciones/agricultores/nueva')}>
            <Plus className="h-4 w-4 mr-2" /> Nueva liquidación
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por código o agricultor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:w-[200px]">
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className="w-full sm:w-[200px]">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
            {puedeDescargar && (
              <Button
                className="sm:ml-auto"
                variant="outline"
                disabled={descargandoConsolidado}
                onClick={handleDescargarConsolidado}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar consolidado
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            El consolidado agrupa por agricultor todas las liquidaciones del rango seleccionado.
          </p>
        </CardContent>
      </Card>

      {filtradas.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="Sin liquidaciones" description="Crea la primera liquidación para un agricultor." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtradasPaginadas.map((l) => (
            <Card key={l.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => navigate(`/liquidaciones/agricultores/${l.id}`)}>
                    <p className="font-medium text-sm">{l.codigo}</p>
                    <p className="text-muted-foreground text-xs">
                      {(l.agricultor as any)?.apellido}, {(l.agricultor as any)?.nombre}
                      {' · '}{formatFecha(l.fecha_inicio)} – {formatFecha(l.fecha_fin)}
                    </p>
                    {esTesoreria && l.estado === 'pagada' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Pago: {l.fecha_pago ? formatFecha(l.fecha_pago) : '-'}
                        {' · '}Operacion: {l.numero_operacion || '-'}
                        {' · '}Modalidad: {l.modalidad_pago === 'transferencia'
                          ? 'Transferencia'
                          : l.modalidad_pago === 'yape_plin'
                            ? 'Yape/Plin'
                            : l.modalidad_pago === 'efectivo'
                              ? 'Efectivo'
                              : '-'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-sm">{formatMoneda(l.total_monto ?? 0)}</p>
                    <EstadoLiquidacionBadge estado={l.estado} />
                    {l.estado === 'borrador' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cambiando}
                          onClick={() => navigate(`/liquidaciones/agricultores/${l.id}/editar`)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cambiando}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setEliminarPendienteId(l.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAccionPendiente({ id: l.id, estado: 'confirmada' })}
                        >
                          Confirmar
                        </Button>
                      </>
                    )}
                    {l.estado === 'confirmada' && (
                      puedePagar ? (
                        <Button size="sm" variant="outline" onClick={() => setPagoPendienteId(l.id)}>
                          Marcar liquidada
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled>
                          Pago solo admin
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[96px]">
                <Select value={String(itemsPorPagina)} onValueChange={(value) => setItemsPorPagina(Number(value))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="/ pag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 / pag</SelectItem>
                    <SelectItem value="10">10 / pag</SelectItem>
                    <SelectItem value="20">20 / pag</SelectItem>
                    <SelectItem value="50">50 / pag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'} filtrado{filtradas.length === 1 ? '' : 's'} · Mostrando {inicioPagina + 1}-{Math.min(finPagina, filtradas.length)}
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={paginaActual <= 1}
                onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground min-w-[90px] text-center">
                Pagina {paginaActual} de {totalPaginas}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmar acción */}
      <ConfirmDialog
        open={!!eliminarPendienteId}
        title="¿Eliminar liquidación?"
        description={`Se eliminará la liquidación. Esta acción es irreversible.`}
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={cambiando}
        onConfirm={() => {
          if (eliminarPendienteId) void handleEliminar(eliminarPendienteId)
        }}
        onCancel={() => setEliminarPendienteId(null)}
      />

      <ConfirmDialog
        open={!!accionPendiente}
        title="¿Confirmar liquidación?"
        description="La liquidación saldrá de borrador y quedará confirmada."
        confirmLabel="Sí, confirmar"
        loading={cambiando}
        onConfirm={() => { void handleCambiarEstado() }}
        onCancel={() => setAccionPendiente(null)}
      />

      <RegistrarPagoDialog
        open={!!pagoPendienteId}
        loading={cambiando}
        title="Registrar pago de liquidación"
        description="Ingresa los datos del pago para marcar la liquidación como liquidada."
        onConfirm={(payload) => handleRegistrarPago(payload)}
        onCancel={() => setPagoPendienteId(null)}
      />
    </div>
  )
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getInicioSemanaLaboralISO(): string {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  return toISODate(monday)
}

function getFinSemanaLaboralISO(): string {
  const now = new Date()
  const day = now.getDay()
  const diffToFriday = day === 0 ? -2 : 5 - day
  const friday = new Date(now)
  friday.setDate(now.getDate() + diffToFriday)
  return toISODate(friday)
}
