import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLiquidacionAgri, actualizarEstadoLiquidacionAgri, pagarLiquidacionAgri, deleteLiquidacionAgri } from '@/services/liquidaciones-agri.service'
import { logAudit } from '@/services/audit.service'
import { RegistrarPagoDialog, type RegistroPagoPayload } from '@/components/shared/RegistrarPagoDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/store/auth.store'
import { Pencil, Trash2 } from 'lucide-react'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'
import { formatFecha, formatMoneda, formatPeso } from '@/utils/formatters'
import type { LiquidacionAgri } from '@/types/models'

export default function DetalleLiquidacionAgriPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const roles = useAuthStore((state) => state.roles)
  const { id } = useParams<{ id: string }>()
  const [liquidacion, setLiquidacion] = useState<LiquidacionAgri | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState(false)
  const [accionPendiente, setAccionPendiente] = useState<'confirmada' | null>(null)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [eliminarPendiente, setEliminarPendiente] = useState(false)

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getLiquidacionAgri(id)
      setLiquidacion(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  const cambiarEstado = async (nuevoEstado: 'confirmada') => {
    if (!liquidacion || !user) return
    setCambiando(true)
    try {
      await actualizarEstadoLiquidacionAgri(liquidacion.id, nuevoEstado)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: liquidacion.id,
        descripcion: `Liquidación confirmada: ${liquidacion.codigo}`,
        datosAnteriores: { estado: 'borrador' },
        datosNuevos: { estado: nuevoEstado },
      })
      await cargar()
    } finally {
      setCambiando(false)
    }
  }

  const handleRegistrarPago = async (payload: RegistroPagoPayload) => {
    if (!liquidacion || !user) return
    setCambiando(true)
    try {
      await pagarLiquidacionAgri(liquidacion.id, payload)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: liquidacion.id,
        descripcion: `Liquidación liquidada: ${liquidacion.codigo}`,
        datosAnteriores: { estado: 'confirmada' },
        datosNuevos: { estado: 'pagada', fecha_pago: payload.fecha_pago },
      })

      const lotes = liquidacion.detalles ?? []
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
      setPagoDialogOpen(false)
    } finally {
      setCambiando(false)
    }
  }

  const handleEliminar = async () => {
    if (!user || !liquidacion) return
    setCambiando(true)
    try {
      await deleteLiquidacionAgri(liquidacion.id)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'eliminar',
        modulo: 'liquidaciones_agri',
        registroId: liquidacion.id,
        descripcion: `Liquidación eliminada: ${liquidacion.codigo}`,
        datosAnteriores: { codigo: liquidacion.codigo, total_monto: liquidacion.total_monto },
        datosNuevos: null,
      })
      navigate('/liquidaciones/agricultores')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
      setEliminarPendiente(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!liquidacion) return null

  const agri = liquidacion.agricultor as any
  const detalles = (liquidacion.detalles as any[]) ?? []
  const puedePagar = hasPermission(roles, APP_PERMISSIONS.LIQUIDACIONES_AGRI_PAY)

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={liquidacion.codigo}
        backHref="/liquidaciones/agricultores"
        actions={
          <div className="flex gap-2">
            {liquidacion.estado === 'borrador' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cambiando}
                  onClick={() => navigate(`/liquidaciones/agricultores/${liquidacion.id}/editar`)}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cambiando}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setEliminarPendiente(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </Button>
              </>
            )}
            {liquidacion.estado === 'borrador' && (
              <Button variant="outline" disabled={cambiando} onClick={() => setAccionPendiente('confirmada')}>
                Confirmar
              </Button>
            )}
            {liquidacion.estado === 'confirmada' && (
              puedePagar ? (
                <Button disabled={cambiando} onClick={() => setPagoDialogOpen(true)}>
                  Marcar liquidada
                </Button>
              ) : (
                <Button disabled variant="secondary">
                  Pago solo admin
                </Button>
              )
            )}
            <EstadoLiquidacionBadge estado={liquidacion.estado} />
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Agricultor</p>
            <p className="font-medium">{agri?.apellido}, {agri?.nombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Periodo</p>
            <p className="font-medium">{formatFecha(liquidacion.fecha_inicio)} - {formatFecha(liquidacion.fecha_fin)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total a pagar</p>
            <p className="font-bold text-agro-green">{formatMoneda(liquidacion.total_monto ?? 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Fecha creación</p>
            <p className="font-medium">{formatFecha(liquidacion.created_at)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles de producción</CardTitle>
        </CardHeader>
        <CardContent>
          {detalles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin detalles.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-muted-foreground hover:bg-transparent">
                  <TableHead className="font-medium">Lote</TableHead>
                  <TableHead className="font-medium">Categoría</TableHead>
                  <TableHead className="text-right font-medium">Peso</TableHead>
                  <TableHead className="text-right font-medium">Precio</TableHead>
                  <TableHead className="text-right font-medium">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalles.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.lote?.codigo ?? d.lote_id}</TableCell>
                    <TableCell className="capitalize">{d.categoria}</TableCell>
                    <TableCell className="text-right">{formatPeso(d.peso_kg)}</TableCell>
                    <TableCell className="text-right">S/. {d.precio_kg}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoneda(d.subtotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right font-bold">Total:</TableCell>
                  <TableCell className="text-right font-bold text-agro-green">{formatMoneda(liquidacion.total_monto ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {liquidacion.observaciones && (
            <p className="text-sm text-muted-foreground mt-4">Obs: {liquidacion.observaciones}</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={eliminarPendiente}
        title="¿Eliminar liquidación?"
        description={`Se eliminará la liquidación ${liquidacion.codigo}. Esta acción es irreversible.`}
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={cambiando}
        onConfirm={() => { void handleEliminar() }}
        onCancel={() => setEliminarPendiente(false)}
      />

      <ConfirmDialog
        open={!!accionPendiente}
        title="¿Confirmar liquidación?"
        description="La liquidación saldrá de borrador y quedará confirmada."
        confirmLabel="Sí, confirmar"
        loading={cambiando}
        onConfirm={() => {
          void cambiarEstado('confirmada')
          setAccionPendiente(null)
        }}
        onCancel={() => setAccionPendiente(null)}
      />

      <RegistrarPagoDialog
        open={pagoDialogOpen}
        loading={cambiando}
        title="Registrar pago de liquidación"
        description="Ingresa los datos del pago para marcar la liquidación como liquidada."
        onConfirm={(payload) => handleRegistrarPago(payload)}
        onCancel={() => setPagoDialogOpen(false)}
      />
    </div>
  )
}
