import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useAuthStore } from '@/store/auth.store'
import { despachoSchema, type DespachoFormData } from '@/utils/validators'
import { CLAVE_PESO_CAJA_DESPACHO, getValorNumericoSistema } from '@/services/config-precios.service'
import { createDespacho, getDespacho, getPalletsDisponiblesParaDespacho, updateDespachoCompleto, type PalletDisponibleDespacho } from '@/services/despachos.service'
import { getLote } from '@/services/lotes.service'
import { logAudit } from '@/services/audit.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DESTINO_DESPACHO_CONFIG, ROUTES, TIPO_DESPACHO_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { calcularPesoNetoDespacho, DEFAULT_PESO_CAJA_DESPACHO_KG, validarLimiteCajasPorTipoDespacho } from '@/utils/business-rules'
import { PalletMultiSelect } from './PalletMultiSelect'

export default function NuevoDespachoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isEditMode = Boolean(id)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pallets, setPallets] = useState<PalletDisponibleDespacho[]>([])
  const [pesoCajaDespachoKg, setPesoCajaDespachoKg] = useState(DEFAULT_PESO_CAJA_DESPACHO_KG)

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<DespachoFormData>({
    resolver: zodResolver(despachoSchema) as never,
    defaultValues: {
      fecha_despacho: format(new Date(), 'yyyy-MM-dd'),
      destino: 'exportacion',
      tipo_despacho: 'terrestre',
      exportador: '',
      marca_caja: '',
      transportista: '',
      placa_vehiculo: '',
      pallet_keys: [],
      num_cajas_despachadas: 0,
      peso_neto_kg: 0,
      observaciones: '',
    },
  })

  const palletKeys = watch('pallet_keys') ?? []
  const tipoDespacho = watch('tipo_despacho')

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      try {
        const [disponibles, pesoConfigurado, despacho] = await Promise.all([
          getPalletsDisponiblesParaDespacho(id),
          getValorNumericoSistema(CLAVE_PESO_CAJA_DESPACHO, DEFAULT_PESO_CAJA_DESPACHO_KG),
          isEditMode && id ? getDespacho(id) : Promise.resolve(null),
        ])
        setPallets(disponibles)
        setPesoCajaDespachoKg(pesoConfigurado)
        if (despacho) {
          reset({
            fecha_despacho: despacho.fecha_despacho,
            destino: despacho.destino,
            tipo_despacho: despacho.tipo_despacho,
            exportador: despacho.exportador ?? '',
            marca_caja: despacho.marca_caja ?? '',
            transportista: despacho.transportista ?? '',
            placa_vehiculo: despacho.placa_vehiculo ?? '',
            pallet_keys: (despacho.pallets ?? []).map((item) => `${item.lote_id}::${item.numero_pallet}`),
            num_cajas_despachadas: despacho.num_cajas_despachadas,
            peso_neto_kg: despacho.peso_neto_kg,
            observaciones: despacho.observaciones ?? '',
          })
        }
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [id, isEditMode, reset])

  const palletsSeleccionados = useMemo(
    () => pallets.filter((item) => palletKeys.includes(item.key)),
    [pallets, palletKeys]
  )

  const totalCajas = palletsSeleccionados.reduce((acc, item) => acc + item.num_cajas, 0)
  const pesoNeto = calcularPesoNetoDespacho(totalCajas, pesoCajaDespachoKg)
  const resumenVariedad = palletsSeleccionados.reduce((acc, item) => {
    acc[item.variedad] += item.num_cajas
    return acc
  }, { snow_peas: 0, sugar: 0 })

  useEffect(() => {
    setValue('num_cajas_despachadas', totalCajas, { shouldValidate: true })
    setValue('peso_neto_kg', pesoNeto, { shouldValidate: true })
  }, [pesoNeto, setValue, totalCajas])

  const onSubmit = async (data: DespachoFormData) => {
    if (!user) return

    const errorLimite = validarLimiteCajasPorTipoDespacho(data.tipo_despacho, totalCajas)
    if (errorLimite) {
      setError(errorLimite)
      return
    }

    try {
      setError(null)
      const payload = {
        lote_id: null,
        fecha_despacho: data.fecha_despacho,
        destino: data.destino,
        tipo_despacho: data.tipo_despacho,
        exportador: data.exportador,
        marca_caja: data.marca_caja,
        transportista: data.transportista,
        placa_vehiculo: data.placa_vehiculo,
        num_cajas_despachadas: totalCajas,
        peso_neto_kg: pesoNeto,
        observaciones: data.observaciones,
      }
      const palletsPayload = palletsSeleccionados.map((item) => ({
        lote_id: item.lote_id,
        numero_pallet: item.numero_pallet,
        num_cajas: item.num_cajas,
      }))

      const despacho = isEditMode && id
        ? await updateDespachoCompleto(id, payload, palletsPayload, user.id)
        : await createDespacho(payload, palletsPayload, user.id)

      const loteIds = Array.from(new Set(palletsSeleccionados.map((item) => item.lote_id)))
      if (loteIds.length > 0) {
        const lotesActualizados = await Promise.all(loteIds.map((loteId) => getLote(loteId)))
        for (const lote of lotesActualizados) {
          if (lote.estado === 'despachado') {
            void logAudit({
              userId: user.id,
              userEmail: user.email ?? '',
              accion: 'actualizar',
              modulo: 'lotes',
              registroId: lote.id,
              descripcion: `Lote despachado: ${lote.codigo}`,
              datosAnteriores: { estado: 'empaquetado' },
              datosNuevos: { estado: 'despachado' },
            })
          }
        }
      }

      navigate(`/despachos/${despacho.id}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <LoadingPage />
  if (error && pallets.length === 0) return <ErrorMessage message={error} onRetry={() => navigate(0)} />

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={isEditMode ? 'Editar despacho' : 'Nuevo despacho'}
        description={isEditMode ? 'Actualiza la salida operativa y la selección de pallets.' : 'Selecciona pallets empaquetados y registra la salida operativa.'}
        backHref={isEditMode && id ? `/despachos/${id}` : ROUTES.DESPACHOS}
      />

      <Card className="mb-4">
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Pallets seleccionados</p>
            <p className="font-bold text-lg">{palletsSeleccionados.length}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total cajas</p>
            <p className="font-bold text-lg">{totalCajas}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Snow Peas</p>
            <p className="font-bold text-lg">{resumenVariedad.snow_peas}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Sugar Snap</p>
            <p className="font-bold text-lg">{resumenVariedad.sugar}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{isEditMode ? 'Editar despacho' : 'Registrar despacho'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit as never)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Fecha despacho" error={errors.fecha_despacho?.message} required>
                <Input type="date" {...register('fecha_despacho')} />
              </FormField>

              <FormField label="Destino" error={errors.destino?.message} required>
                <Controller name="destino" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DESTINO_DESPACHO_CONFIG).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FormField>

              <FormField label="Tipo de despacho" error={errors.tipo_despacho?.message} required>
                <Controller name="tipo_despacho" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_DESPACHO_CONFIG).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FormField>

              <FormField label="Exportador" error={errors.exportador?.message}>
                <Input placeholder="Nombre del exportador" {...register('exportador')} />
              </FormField>

              <FormField label="Marca de caja" error={errors.marca_caja?.message}>
                <Input placeholder="Marca comercial" {...register('marca_caja')} />
              </FormField>

              <FormField label="Proveedor de transporte" error={errors.transportista?.message}>
                <Input placeholder="Nombre del proveedor de transporte" {...register('transportista')} />
              </FormField>

              <FormField label="Placa" error={errors.placa_vehiculo?.message}>
                <Input placeholder="ABC-123" {...register('placa_vehiculo')} />
              </FormField>

              <FormField label="Pallets a despachar" error={errors.pallet_keys?.message} required>
                <Controller name="pallet_keys" control={control} render={({ field }) => (
                  <PalletMultiSelect options={pallets} selectedKeys={field.value ?? []} onChange={field.onChange} />
                )} />
              </FormField>

              <FormField label="N° cajas a despachar" error={errors.num_cajas_despachadas?.message} required>
                <Input value={String(totalCajas)} readOnly className="bg-muted/40 text-foreground" />
                {(tipoDespacho === 'maritima' || tipoDespacho === 'aerea') && (
                  <p className="text-xs text-muted-foreground mt-1">Máximo permitido para despacho marítimo o aéreo: 3440 cajas.</p>
                )}
              </FormField>

              <FormField label="Peso neto (kg)" error={errors.peso_neto_kg?.message} required>
                <Input value={pesoNeto.toFixed(2)} readOnly className="bg-muted/40 text-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Calculado automáticamente como cajas seleccionadas × {pesoCajaDespachoKg.toFixed(2)} kg.</p>
              </FormField>
            </div>

            {palletsSeleccionados.length > 0 && (
              <div className="rounded-lg border bg-muted/10 p-3 text-sm">
                <p className="font-medium mb-2">Pallets seleccionados</p>
                <div className="flex flex-col gap-1.5">
                  {palletsSeleccionados.map((item) => (
                    <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 bg-background">
                      <span>Pallet {item.numero_pallet} · {item.lote_codigo}</span>
                      <span className="text-muted-foreground">{VARIEDAD_PRODUCTO_CONFIG[item.variedad].label} · {item.num_cajas} cajas</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FormField label="Observaciones" error={errors.observaciones?.message}>
              <Textarea rows={3} {...register('observaciones')} />
            </FormField>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(isEditMode && id ? `/despachos/${id}` : ROUTES.DESPACHOS)}>Cancelar</Button>
              <Button type="submit" loading={isSubmitting}>{isEditMode ? 'Guardar cambios' : 'Registrar despacho'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}