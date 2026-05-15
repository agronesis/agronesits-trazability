import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Printer, Trash2 } from 'lucide-react'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { logAudit } from '@/services/audit.service'
import { getColaboradores } from '@/services/colaboradores.service'
import {
  createEmpaquetado,
  deleteEmpaquetado,
  getEmpaquetadosPorLote,
  getResumenPalletsEmpaquetado,
} from '@/services/empaquetados.service'
import { CLAVE_PESO_CAJA_EXPORTACION, getValorNumericoSistema } from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ColaboradorPicker } from '@/components/shared/ColaboradorPicker'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth.store'
import { empaquetadoSchema, type EmpaquetadoFormData } from '@/utils/validators'
import { formatFecha } from '@/utils/formatters'
import { CAJAS_POR_PALLET, calcularCajasExportables, calcularPesoTotalClasificado, DEFAULT_PESO_CAJA_EXPORTACION_KG, normalizarNumeroPallet } from '@/utils/business-rules'
import { getTraceabilityCodeForDate, printEmpaquetadoLabel } from './printDespachoLabel'
import type { Clasificacion, Colaborador, Empaquetado, Lote } from '@/types/models'

const DESTINO_LABELS = {
  europa: 'Europa',
  usa: 'USA',
} as const

export default function EmpaquetarLotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [empaquetados, setEmpaquetados] = useState<Empaquetado[]>([])
  const [resumenPallets, setResumenPallets] = useState<Record<string, number>>({})
  const [pesoCajaExportacionKg, setPesoCajaExportacionKg] = useState(DEFAULT_PESO_CAJA_EXPORTACION_KG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [finalizando, setFinalizando] = useState(false)
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false)
  const [labelEmpaquetado, setLabelEmpaquetado] = useState<Empaquetado | null>(null)
  const [empaquetadores, setEmpaquetadores] = useState<Colaborador[]>([])

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<EmpaquetadoFormData>({
    resolver: zodResolver(empaquetadoSchema) as never,
    defaultValues: {
      lote_id: id ?? '',
      colaborador_id: null,
      fecha_empaquetado: format(new Date(), 'yyyy-MM-dd'),
      destino: 'europa',
      codigo_trazabilidad: '',
      numero_pallet: '',
      num_cajas: undefined as never,
      observaciones: '',
    },
  })

  const fechaEmpaquetado = watch('fecha_empaquetado')
  const numeroPallet = normalizarNumeroPallet(watch('numero_pallet') ?? '')
  const numCajas = watch('num_cajas') ?? 0

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [l, cls, emp, pallets, pesoCajaConfigurado, colabs] = await Promise.all([
        getLote(id),
        getClasificacionesPorLote(id),
        getEmpaquetadosPorLote(id),
        getResumenPalletsEmpaquetado(id),
        getValorNumericoSistema(CLAVE_PESO_CAJA_EXPORTACION, DEFAULT_PESO_CAJA_EXPORTACION_KG),
        getColaboradores(),
      ])
      setLote(l)
      setClasificaciones(cls)
      setEmpaquetados(emp)
      setResumenPallets(pallets)
      setPesoCajaExportacionKg(pesoCajaConfigurado)
      setEmpaquetadores(colabs.filter((c) => c.rol === 'empaquetador'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (!lote || !fechaEmpaquetado) return
    setValue('codigo_trazabilidad', getTraceabilityCodeForDate(lote, fechaEmpaquetado), { shouldValidate: true })
  }, [fechaEmpaquetado, lote, setValue])

  const totalCajasExportables = useMemo(
    () => calcularCajasExportables(calcularPesoTotalClasificado(clasificaciones), pesoCajaExportacionKg),
    [clasificaciones, pesoCajaExportacionKg]
  )
  const totalCajasEmpaquetadas = empaquetados.reduce((acc, item) => acc + item.num_cajas, 0)
  const cajasPendientes = Math.max(0, totalCajasExportables - totalCajasEmpaquetadas)
  const palletActualAcumulado = resumenPallets[numeroPallet] ?? 0
  const palletActualDisponible = Math.max(0, CAJAS_POR_PALLET - palletActualAcumulado)
  const palletsUsados = Object.keys(resumenPallets).length
  const puedeEditar = lote?.estado === 'clasificado' || lote?.estado === 'empaquetado'

  const onSubmit = async (data: EmpaquetadoFormData) => {
    if (!id || !user || !lote) return

    setFormError(null)
    const numeroPalletNormalizado = data.numero_pallet
    const acumuladoActual = resumenPallets[numeroPalletNormalizado] ?? 0
    const totalConNuevoRegistro = totalCajasEmpaquetadas + data.num_cajas

    if (totalConNuevoRegistro > totalCajasExportables) {
      setFormError(`Las cajas empaquetadas (${totalConNuevoRegistro}) no pueden superar las exportables del lote (${totalCajasExportables}).`)
      return
    }

    if (acumuladoActual + data.num_cajas > CAJAS_POR_PALLET) {
      setFormError(`El pallet ${numeroPalletNormalizado} quedaría con ${acumuladoActual + data.num_cajas} cajas y excede el máximo de ${CAJAS_POR_PALLET}.`)
      return
    }

    const nuevo = await createEmpaquetado({
      ...data,
      numero_pallet: numeroPalletNormalizado,
      codigo_trazabilidad: getTraceabilityCodeForDate(lote, data.fecha_empaquetado),
      lote_id: id,
      colaborador_id: data.colaborador_id ?? null,
      observaciones: data.observaciones || null,
    }, user.id)

    const nuevoResumenPallets = {
      ...resumenPallets,
      [numeroPalletNormalizado]: (resumenPallets[numeroPalletNormalizado] ?? 0) + nuevo.num_cajas,
    }
    setEmpaquetados((prev) => [nuevo, ...prev])
    setResumenPallets(nuevoResumenPallets)
    setLabelEmpaquetado(nuevo)

    if (lote.estado === 'clasificado') {
      const actualizado = await actualizarEstadoLote(lote.id, 'empaquetado')
      setLote(actualizado)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'lotes',
        registroId: lote.id,
        descripcion: `Lote empaquetado: ${lote.codigo}`,
        datosAnteriores: { estado: 'clasificado' },
        datosNuevos: { estado: 'empaquetado' },
      })
    }

    reset({
      lote_id: id,
      colaborador_id: null,
      fecha_empaquetado: format(new Date(), 'yyyy-MM-dd'),
      destino: 'europa',
      codigo_trazabilidad: getTraceabilityCodeForDate(lote, format(new Date(), 'yyyy-MM-dd')),
      numero_pallet: '',
      num_cajas: undefined as never,
      observaciones: '',
    })
  }

  const onDelete = async (item: Empaquetado) => {
    await deleteEmpaquetado(item.id)
    setEmpaquetados((prev) => prev.filter((row) => row.id !== item.id))
    setResumenPallets((prev) => {
      const totalActual = prev[item.numero_pallet] ?? 0
      const nuevoTotal = totalActual - item.num_cajas
      if (nuevoTotal <= 0) {
        const clone = { ...prev }
        delete clone[item.numero_pallet]
        return clone
      }
      return { ...prev, [item.numero_pallet]: nuevoTotal }
    })
  }

  const onFinalizar = async () => {
    if (!id || !lote) return
    setFinalizando(true)
    try {
      navigate(`/lotes/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setFinalizando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title={`Empaquetado — ${lote.codigo}`}
          description="Registro de cajas por pallet antes del despacho"
          backHref={`/lotes/${id}`}
        />

        <Card className="mb-4">
          <CardContent className="pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Cajas exportables</p>
              <p className="font-bold text-lg">{totalCajasExportables}</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center">
              <p className="text-xs text-indigo-700">Cajas empaquetadas</p>
              <p className="font-bold text-lg text-indigo-700">{totalCajasEmpaquetadas}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-700">Pendientes por empaquetar</p>
              <p className="font-bold text-lg text-amber-700">{cajasPendientes}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-center">
              <p className="text-xs text-sky-700">Pallets usados</p>
              <p className="font-bold text-lg text-sky-700">{palletsUsados}</p>
            </div>
          </CardContent>
        </Card>

        {puedeEditar && cajasPendientes > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Registrar empaquetado</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit as never)} className="flex flex-col gap-4">
                <Input type="hidden" {...register('lote_id')} value={id} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Empaquetador" error={errors.colaborador_id?.message}>
                    <Controller name="colaborador_id" control={control} render={({ field }) => (
                      <ColaboradorPicker
                        value={field.value ?? ''}
                        onChange={(v) => field.onChange(v || null)}
                        colaboradores={empaquetadores}
                        placeholder="Seleccionar empaquetador..."
                      />
                    )} />
                  </FormField>

                  <FormField label="Fecha de empaquetado" error={errors.fecha_empaquetado?.message} required>
                    <Input type="date" {...register('fecha_empaquetado')} />
                  </FormField>

                  <FormField label="Destino" error={errors.destino?.message} required>
                    <Controller name="destino" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="europa">Europa</SelectItem>
                            <SelectItem value="usa">USA</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                  </FormField>

                  <FormField label="Código de trazabilidad" error={errors.codigo_trazabilidad?.message} required>
                    <Input {...register('codigo_trazabilidad')} disabled className="bg-muted/40 text-foreground disabled:opacity-100 disabled:text-foreground font-mono" />
                  </FormField>

                  <FormField label="N° de pallet" error={errors.numero_pallet?.message} required>
                    <Input inputMode="numeric" maxLength={3} placeholder="001" {...register('numero_pallet')} />
                    {numeroPallet && (
                      <p className="text-xs text-muted-foreground">Acumuladas en {numeroPallet}: {palletActualAcumulado} cajas · Disponible: {palletActualDisponible}</p>
                    )}
                  </FormField>

                  <FormField label="Cantidad de cajas" error={errors.num_cajas?.message} required>
                    <Input type="number" min="1" max={CAJAS_POR_PALLET} step="1" {...register('num_cajas', { valueAsNumber: true })} />
                    {numCajas > 0 && numeroPallet && (
                      <p className="text-xs text-muted-foreground">Con este registro el pallet quedaría con {palletActualAcumulado + numCajas} / {CAJAS_POR_PALLET} cajas.</p>
                    )}
                  </FormField>
                </div>

                <FormField label="Observaciones" error={errors.observaciones?.message}>
                  <Textarea rows={2} {...register('observaciones')} />
                </FormField>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <div className="flex justify-end">
                  <Button type="submit" loading={isSubmitting}>Registrar empaquetado</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {puedeEditar && cajasPendientes === 0 && empaquetados.length > 0 && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">
            Todas las cajas han sido empaquetadas ({totalCajasEmpaquetadas} / {totalCajasExportables}). Puedes confirmar el empaquetado para pasar al despacho.
          </div>
        )}

        {empaquetados.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Registros de empaquetado</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {empaquetados.map((item) => {
                const palletNormalizado = normalizarNumeroPallet(item.numero_pallet)
                const acumuladoPallet = resumenPallets[palletNormalizado] ?? item.num_cajas
                return (
                  <div key={item.id} className="border rounded-lg px-3 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">Pallet {palletNormalizado}</span>
                          <span className="text-muted-foreground">{formatFecha(item.fecha_empaquetado)}</span>
                          <span className="text-indigo-700 font-medium">{item.num_cajas} cajas</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Destino: {DESTINO_LABELS[item.destino]} · Acumulado del pallet: {acumuladoPallet} / {CAJAS_POR_PALLET}</p>
                        {item.colaborador_id && (() => {
                          const emp = empaquetadores.find((c) => c.id === item.colaborador_id)
                          return emp ? (
                            <p className="text-xs mt-1">
                              <span className="text-muted-foreground">Empaquetador: </span>
                              <span className="font-medium text-indigo-700">{emp.apellido}, {emp.nombre}</span>
                            </p>
                          ) : null
                        })()}
                        <p className="font-mono text-xs text-muted-foreground mt-1">Traz.: {item.codigo_trazabilidad}</p>
                        {item.observaciones && <p className="text-xs text-muted-foreground mt-1">{item.observaciones}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Imprimir etiqueta" onClick={() => printEmpaquetadoLabel(lote, item)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        {puedeEditar && (
                          <Button variant="ghost" size="icon" className="text-destructive" title="Eliminar registro" onClick={() => onDelete(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {puedeEditar && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(`/lotes/${id}`)}>Cancelar</Button>
            <Button disabled={empaquetados.length === 0 || finalizando} onClick={() => setConfirmarFinalizar(true)}>
              {finalizando ? 'Procesando...' : 'Confirmar empaquetado'}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmarFinalizar}
        title="¿Confirmar empaquetado?"
        description="El lote quedará listo para que sus pallets se usen luego en el módulo de despachos."
        confirmLabel="Sí, confirmar"
        variant="default"
        loading={finalizando}
        onConfirm={() => { setConfirmarFinalizar(false); onFinalizar() }}
        onCancel={() => setConfirmarFinalizar(false)}
      />

      <ConfirmDialog
        open={Boolean(labelEmpaquetado)}
        title="Empaquetado registrado"
        description={labelEmpaquetado ? `Pallet ${normalizarNumeroPallet(labelEmpaquetado.numero_pallet)} · ${labelEmpaquetado.num_cajas} cajas` : ''}
        confirmLabel="Imprimir etiqueta"
        cancelLabel="Continuar"
        variant="default"
        onConfirm={() => {
          if (labelEmpaquetado && lote) printEmpaquetadoLabel(lote, labelEmpaquetado)
          setLabelEmpaquetado(null)
        }}
        onCancel={() => setLabelEmpaquetado(null)}
      />
    </>
  )
}