import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { endOfISOWeek, format, getISOWeek, getYear, setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns'
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import {
  createConfigPrecio,
  deleteConfigPrecio,
  getConfigPrecios,
  updateConfigPrecio,
} from '@/services/config-precios.service'
import { CALIDAD_PRODUCTO_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/store/auth.store'
import { logAudit } from '@/services/audit.service'
import type { ConfigPrecio } from '@/types/models'

const configPrecioSchema = z.object({
  semana: z.number({ message: 'Ingrese un número' }).int().min(1).max(53),
  anio: z.number({ message: 'Ingrese un número' }).int().min(2024),
  variedad: z.enum(['snow_peas', 'sugar']),
  categoria: z.enum(['cat1', 'cat2']),
  precio_kg_sol: z.number({ message: 'Ingrese un número' }).nonnegative().max(9999),
})

type FormData = z.infer<typeof configPrecioSchema>

export default function ConfigPreciosPage() {
  const { user } = useAuthStore()
  const [precios, setPrecios] = useState<ConfigPrecio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<ConfigPrecio | null>(null)
  const [precioAEliminar, setPrecioAEliminar] = useState<ConfigPrecio | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [precioPendienteConfirmacion, setPrecioPendienteConfirmacion] = useState<FormData | null>(null)
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const semanaActual = getISOWeek(new Date())
  const anioActual = getYear(new Date())

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(configPrecioSchema),
    defaultValues: {
      semana: semanaActual,
      anio: anioActual,
      variedad: 'snow_peas',
      categoria: 'cat1',
      precio_kg_sol: undefined,
    },
  })

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      setPrecios(await getConfigPrecios())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const abrirNuevo = () => {
    setEditando(null)
    reset({
      semana: semanaActual,
      anio: anioActual,
      variedad: 'snow_peas',
      categoria: 'cat1',
      precio_kg_sol: undefined,
    })
    setDialogOpen(true)
  }

  const abrirEditar = (precio: ConfigPrecio) => {
    setEditando(precio)
    reset({
      semana: precio.semana,
      anio: precio.anio,
      variedad: precio.variedad,
      categoria: precio.categoria,
      precio_kg_sol: precio.precio_kg_sol,
    })
    setDialogOpen(true)
  }

  const onSubmit = (data: FormData) => {
    setFormError(null)
    setPrecioPendienteConfirmacion(data)
  }

  const confirmarGuardadoPrecio = async () => {
    if (!user || !precioPendienteConfirmacion) return

    try {
      setGuardandoPrecio(true)
      setFormError(null)

      if (editando) {
        const updated = await updateConfigPrecio(editando.id, precioPendienteConfirmacion)
        setPrecios((prev) => prev.map((precio) => (precio.id === updated.id ? updated : precio)))
        void logAudit({
          userId: user.id,
          userEmail: user.email ?? '',
          accion: 'actualizar',
          modulo: 'config_precios',
          registroId: editando.id,
          descripcion: `Precio actualizado: Sem ${updated.semana}/${updated.anio} — ${updated.variedad} ${updated.categoria}`,
          datosAnteriores: { semana: editando.semana, anio: editando.anio, variedad: editando.variedad, categoria: editando.categoria, precio_kg_sol: editando.precio_kg_sol },
          datosNuevos: { semana: updated.semana, anio: updated.anio, variedad: updated.variedad, categoria: updated.categoria, precio_kg_sol: updated.precio_kg_sol },
        })
      } else {
        const nuevo = await createConfigPrecio(precioPendienteConfirmacion, user.id)
        setPrecios((prev) => [nuevo, ...prev])
        void logAudit({
          userId: user.id,
          userEmail: user.email ?? '',
          accion: 'crear',
          modulo: 'config_precios',
          registroId: nuevo.id,
          descripcion: `Precio creado: Sem ${nuevo.semana}/${nuevo.anio} — ${nuevo.variedad} ${nuevo.categoria}`,
          datosAnteriores: null,
          datosNuevos: { semana: nuevo.semana, anio: nuevo.anio, variedad: nuevo.variedad, categoria: nuevo.categoria, precio_kg_sol: nuevo.precio_kg_sol },
        })
      }

      setPrecioPendienteConfirmacion(null)
      setDialogOpen(false)
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setGuardandoPrecio(false)
    }
  }

  const eliminar = async (precio: ConfigPrecio) => {
    if (!user) return
    try {
      await deleteConfigPrecio(precio.id)
      setPrecios((prev) => prev.filter((item) => item.id !== precio.id))
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'eliminar',
        modulo: 'config_precios',
        registroId: precio.id,
        descripcion: `Precio eliminado: Sem ${precio.semana}/${precio.anio} — ${precio.variedad} ${precio.categoria}`,
        datosAnteriores: { semana: precio.semana, anio: precio.anio, variedad: precio.variedad, categoria: precio.categoria, precio_kg_sol: precio.precio_kg_sol },
        datosNuevos: null,
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  const preciosPorAnio = precios.reduce<Record<number, ConfigPrecio[]>>((acc, precio) => {
    if (!acc[precio.anio]) acc[precio.anio] = []
    acc[precio.anio].push(precio)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Precios por Semana"
        description="Precio S/./kg por semana, variedad y categoría. Usado en liquidaciones de agricultores."
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Semana actual: <span className="font-medium">Sem. {semanaActual} / {anioActual}</span>
        </p>
        <Button onClick={abrirNuevo}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo precio
        </Button>
      </div>

      {precios.length === 0 ? (
        <EmptyState
          icon={<Settings className="h-8 w-8" />}
          title="Sin configuración de precios"
          description="Agrega el precio S/./kg para la semana actual antes de crear liquidaciones."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.keys(preciosPorAnio)
            .map(Number)
            .sort((a, b) => b - a)
            .map((anio) => (
              <div key={anio}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Año {anio}</p>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Semana</TableHead>
                          <TableHead>Rango</TableHead>
                          <TableHead>Variedad</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Precio S/./kg</TableHead>
                          <TableHead className="w-20" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preciosPorAnio[anio]
                          .sort((a, b) => b.semana - a.semana)
                          .map((precio) => (
                            <TableRow key={precio.id}>
                              <TableCell className="font-medium">Sem. {precio.semana}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatearRangoSemanaIso(precio.anio, precio.semana)}
                              </TableCell>
                              <TableCell>{VARIEDAD_PRODUCTO_CONFIG[precio.variedad].label}</TableCell>
                              <TableCell>{getCalidadProductoLabel(precio.categoria)}</TableCell>
                              <TableCell className="text-right font-semibold">
                                S/. {Number(precio.precio_kg_sol).toFixed(4)}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(precio)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setPrecioAEliminar(precio)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ))}
        </div>
      )}

      <ConfirmDialog
        open={!!precioAEliminar}
        title="¿Eliminar precio?"
        description={precioAEliminar
          ? `Sem ${precioAEliminar.semana}/${precioAEliminar.anio} — ${VARIEDAD_PRODUCTO_CONFIG[precioAEliminar.variedad].label} ${getCalidadProductoLabel(precioAEliminar.categoria)}`
          : ''}
        confirmLabel="Eliminar"
        onConfirm={() => {
          void eliminar(precioAEliminar!)
          setPrecioAEliminar(null)
        }}
        onCancel={() => setPrecioAEliminar(null)}
      />

      <ConfirmDialog
        open={!!precioPendienteConfirmacion}
        title={editando ? '¿Confirmar actualización de precio?' : '¿Confirmar creación de precio?'}
        description={precioPendienteConfirmacion
          ? `Sem ${precioPendienteConfirmacion.semana}/${precioPendienteConfirmacion.anio} · ${VARIEDAD_PRODUCTO_CONFIG[precioPendienteConfirmacion.variedad].label} · ${getCalidadProductoLabel(precioPendienteConfirmacion.categoria)} · S/. ${Number(precioPendienteConfirmacion.precio_kg_sol).toFixed(4)}`
          : ''}
        confirmLabel={editando ? 'Sí, actualizar' : 'Sí, crear'}
        variant="default"
        loading={guardandoPrecio}
        onConfirm={() => {
          void confirmarGuardadoPrecio()
        }}
        onCancel={() => setPrecioPendienteConfirmacion(null)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar precio' : 'Nuevo precio'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-4">
            {formError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Año" error={errors.anio?.message} required>
                <Input type="number" min="2024" {...register('anio', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Semana (1-53)" error={errors.semana?.message} required>
                <Input type="number" min="1" max="53" {...register('semana', { valueAsNumber: true })} />
              </FormField>
            </div>

            <FormField label="Variedad" error={errors.variedad?.message} required>
              <Controller
                name="variedad"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snow_peas">Snow Peas</SelectItem>
                      <SelectItem value="sugar">Sugar Snap</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Categoría" error={errors.categoria?.message} required>
              <Controller
                name="categoria"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cat1">CAT 1</SelectItem>
                      <SelectItem value="cat2">CAT 2</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Precio S/./kg" error={errors.precio_kg_sol?.message} required>
              <Input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                {...register('precio_kg_sol', { valueAsNumber: true })}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting || guardandoPrecio}>
                {editando ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getCalidadProductoLabel(categoria: string): string {
  return CALIDAD_PRODUCTO_CONFIG[categoria as keyof typeof CALIDAD_PRODUCTO_CONFIG]?.label ?? categoria
}

function formatearRangoSemanaIso(anio: number, semana: number): string {
  const referencia = setISOWeek(setISOWeekYear(new Date(), anio), semana)
  const inicio = startOfISOWeek(referencia)
  const fin = endOfISOWeek(referencia)
  return `${format(inicio, 'dd/MM/yyyy')} - ${format(fin, 'dd/MM/yyyy')}`
}
