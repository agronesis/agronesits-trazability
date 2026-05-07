import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { movimientoCubetaSchema, type MovimientoCubetaFormData } from '@/utils/validators'
import {
  getResumenCubetasAllAgricultores,
  getMovimientosPorAgricultor,
  createMovimientoCubeta,
} from '@/services/cubetas.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { TipoMovimientoBadge } from '@/components/shared/StatusBadge'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAgricultores } from '@/features/agricultores/hooks/useAgricultores'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha } from '@/utils/formatters'
import { Package2, Plus } from 'lucide-react'
import { format } from 'date-fns'
import type { BalanceCubetaAgri, MovimientoCubeta } from '@/types/models'

export default function CubetasPage() {
  const { user } = useAuthStore()
  const { agricultores } = useAgricultores()

  const [balances, setBalances] = useState<BalanceCubetaAgri[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoCubeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [agricultorSeleccionado, setAgricultorSeleccionado] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<MovimientoCubetaFormData>({
    resolver: zodResolver(movimientoCubetaSchema) as any,
    defaultValues: {
      tipo: 'entrega',
      fecha: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const cargarBalances = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getResumenCubetasAllAgricultores()
      setBalances(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const cargarMovimientos = async (agricultorId: string) => {
    const data = await getMovimientosPorAgricultor(agricultorId)
    setMovimientos(data)
  }

  useEffect(() => { cargarBalances() }, [])

  useEffect(() => {
    if (agricultorSeleccionado) cargarMovimientos(agricultorSeleccionado)
    else setMovimientos([])
  }, [agricultorSeleccionado])

  const onSubmit = async (data: MovimientoCubetaFormData) => {
    if (!user) return

    await createMovimientoCubeta(data, user.id)
    setDialogOpen(false)
    reset({ tipo: 'entrega', fecha: format(new Date(), 'yyyy-MM-dd') })

    await cargarBalances()
    if (agricultorSeleccionado) await cargarMovimientos(agricultorSeleccionado)
  }

  const agricultoresActivos = agricultores.filter((a) => a.estado === 'activo')

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargarBalances} />

  return (
    <div>
      <PageHeader
        title="Control de Cubetas"
        description="Seguimiento de entrega y devolución de cubetas por agricultor"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar movimiento
          </Button>
        }
      />

      {balances.length === 0 ? (
        <EmptyState icon={Package2} title="Sin movimientos" description="Registra el primer movimiento de cubetas." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {balances.map((b) => {
            const agri = agricultores.find((a) => a.id === b.agricultor_id)
            const isSelected = agricultorSeleccionado === b.agricultor_id

            return (
              <Card
                key={b.agricultor_id}
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-agro-green' : 'hover:shadow-md'}`}
                onClick={() => setAgricultorSeleccionado(isSelected ? null : b.agricultor_id)}
              >
                <CardContent className="pt-4">
                  <p className="font-medium text-sm">{agri?.apellido ?? '–'}, {agri?.nombre ?? '–'}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <span>Entregadas: <strong className="text-foreground">{b.total_entregadas}</strong></span>
                    <span>Devueltas: <strong className="text-foreground">{b.total_devueltas}</strong></span>
                    <span className={b.saldo_pendiente > 0 ? 'text-destructive font-medium' : ''}>
                      Saldo: <strong>{b.saldo_pendiente}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {agricultorSeleccionado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Movimientos - {(() => {
                const a = agricultores.find((x) => x.id === agricultorSeleccionado)
                return `${a?.apellido ?? ''}, ${a?.nombre ?? ''}`
              })()}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-2">
            {movimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos.</p>
            ) : movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <TipoMovimientoBadge tipo={m.tipo} />
                  <span className="ml-2 text-muted-foreground">{formatFecha(m.fecha)}</span>
                  {m.observaciones && <p className="text-xs text-muted-foreground">{m.observaciones}</p>}
                </div>
                <span className="font-bold text-base">{m.cantidad}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimiento de cubetas</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col gap-4">
            <FormField label="Agricultor" error={errors.agricultor_id?.message} required>
              <Controller
                name="agricultor_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {agricultoresActivos.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.apellido}, {a.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Tipo" error={errors.tipo?.message} required>
                <Controller
                  name="tipo"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrega">Entrega</SelectItem>
                        <SelectItem value="devolucion">Devolución</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label="Cantidad" error={errors.cantidad?.message} required>
                <Input type="number" min="1" step="1" {...register('cantidad', { valueAsNumber: true })} />
              </FormField>

              <FormField label="Fecha" error={errors.fecha?.message} required>
                <Input type="date" {...register('fecha')} />
              </FormField>

              <FormField label="Lote (opcional)" error={errors.lote_id?.message}>
                <Input placeholder="UUID del lote" {...register('lote_id')} />
              </FormField>
            </div>

            <FormField label="Observaciones" error={errors.observaciones?.message}>
              <Textarea rows={2} {...register('observaciones')} />
            </FormField>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={isSubmitting}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
