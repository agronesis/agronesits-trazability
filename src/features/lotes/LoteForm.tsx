import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { loteSchema, type LoteFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AcopiadorPicker } from '@/components/shared/AcopiadorPicker'
import { FormField } from '@/components/shared/FormField'
import { useAgricultores } from '@/features/agricultores/hooks/useAgricultores'
import { useAcopiadores } from '@/features/acopiadores/hooks/useAcopiadores'
import { useProductos } from '@/features/productos/hooks/useProductos'
import { useCentrosAcopio } from '@/features/centros-acopio/hooks/useCentrosAcopio'
import { useColaboradores } from '@/features/colaboradores/hooks/useColaboradores'
import { calcularPesoPorJaba } from '@/utils/business-rules'
import { format } from 'date-fns'

type LoteFormInput = z.input<typeof loteSchema>

interface LoteFormProps {
  defaultValues?: Partial<LoteFormData>
  onSubmit: (data: LoteFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function LoteForm({ defaultValues, onSubmit, onCancel, isEditing }: LoteFormProps) {
  const { agricultores } = useAgricultores()
  const { acopiadores } = useAcopiadores()
  const { productos } = useProductos()
  const { centros } = useCentrosAcopio()
  const { colaboradores } = useColaboradores()

  const normalizedDefaults = useMemo<Partial<LoteFormInput>>(() => {
    const fechaIngreso = defaultValues?.fecha_ingreso ?? format(new Date(), 'yyyy-MM-dd')

    return {
      codigo: defaultValues?.codigo ?? 'AUTO',
      agricultor_id: defaultValues?.agricultor_id ?? '',
      recepcionista_id: defaultValues?.recepcionista_id ?? '',
      acopiador_combined: defaultValues?.acopiador_agricultor_id
        ? `agri:${defaultValues.acopiador_agricultor_id}`
        : defaultValues?.acopiador_id
        ? `aco:${defaultValues.acopiador_id}`
        : '',
      producto_id: defaultValues?.producto_id ?? '',
      centro_acopio_id: defaultValues?.centro_acopio_id ?? '',
      fecha_ingreso: fechaIngreso,
      fecha_cosecha: defaultValues?.fecha_cosecha ?? fechaIngreso,
      peso_tara_kg: defaultValues?.peso_tara_kg,
      peso_neto_kg: defaultValues?.peso_neto_kg ?? 0,
      num_cubetas: defaultValues?.num_cubetas,
      jabas_prestadas: defaultValues?.jabas_prestadas,
      ...defaultValues,
      observaciones: defaultValues?.observaciones ?? '',
    }
  }, [defaultValues])

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<LoteFormInput>({
    resolver: zodResolver(loteSchema) as any,
    defaultValues: normalizedDefaults,
  })

  useEffect(() => {
    reset(normalizedDefaults)
  }, [normalizedDefaults, reset])

  const pesoBruto = watch('peso_bruto_kg')
  const pesoTara = watch('peso_tara_kg')
  const numCubetas = watch('num_cubetas')
  const pesoNeto = watch('peso_neto_kg')
  const pesoPorJaba = calcularPesoPorJaba(
    Number.isFinite(pesoNeto) ? Number(pesoNeto) : 0,
    Number.isFinite(numCubetas) ? Number(numCubetas) : 0,
  )

  useEffect(() => {
    const bruto = Number.isFinite(pesoBruto) ? Number(pesoBruto) : 0
    const taraJaba = Number.isFinite(pesoTara) ? Number(pesoTara) : 0
    const jabas = Number.isFinite(numCubetas) ? Number(numCubetas) : 0
    const neto = Math.max(bruto - taraJaba * jabas, 0)
    setValue('peso_neto_kg', Number(neto.toFixed(2)), { shouldValidate: true, shouldDirty: true })
  }, [pesoBruto, pesoTara, numCubetas, setValue])

  const agricultoresActivos = agricultores.filter((a) => a.estado === 'activo')
  const recepcionistasActivos = colaboradores.filter((c) => c.estado === 'activo' && c.rol === 'recepcionista')
  const acopiadoresActivos = acopiadores.filter((a) => a.estado === 'activo')
  const productosActivos = productos
  const centrosActivos = centros.filter((c) => c.estado === 'activo')

  const handleValidSubmit = async (data: LoteFormInput) => {
    const { acopiador_combined: _c, ...rest } = loteSchema.parse(data) as any
    await onSubmit(rest as LoteFormData)
  }

  return (
    <form onSubmit={handleSubmit(handleValidSubmit as any)} className="flex flex-col gap-4">
      <Input type="hidden" {...register('codigo')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Fecha de ingreso" error={errors.fecha_ingreso?.message} required>
          <Input type="date" {...register('fecha_ingreso')} />
        </FormField>

        <FormField label="Fecha de cosecha" error={errors.fecha_cosecha?.message} required>
          <Input type="date" {...register('fecha_cosecha')} />
        </FormField>

        <FormField label="Código de lote por agricultor" error={errors.codigo_lote_agricultor?.message}>
          <Input placeholder="Ej: LOTE-A-001" maxLength={30} {...register('codigo_lote_agricultor')} />
        </FormField>

        <FormField label="Agricultor" error={errors.agricultor_id?.message} required className="sm:col-span-2">
          <Controller name="agricultor_id" control={control} render={({ field }) => (
            <Select
              onValueChange={field.onChange}
              value={field.value ?? ''}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar agricultor..." /></SelectTrigger>
              <SelectContent>
                {agricultoresActivos.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.apellido}, {a.nombre} ({a.codigo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Nombre del recepcionista" error={errors.recepcionista_id?.message} required className="sm:col-span-2">
          <Controller name="recepcionista_id" control={control} render={({ field }) => (
            <Select
              onValueChange={field.onChange}
              value={field.value ?? ''}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar recepcionista..." /></SelectTrigger>
              <SelectContent>
                {recepcionistasActivos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.apellido}, {c.nombre} ({c.codigo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField
          label="Acopiador"
          error={errors.acopiador_combined?.message}
          className="sm:col-span-2"
        >
          <Controller name="acopiador_combined" control={control} render={({ field }) => (
            <AcopiadorPicker
              value={field.value ?? ''}
              onChange={field.onChange}
              acopiadores={acopiadoresActivos}
              agricultores={agricultoresActivos}
              error={!!errors.acopiador_combined}
            />
          )} />
        </FormField>

        <FormField label="Producto" error={errors.producto_id?.message} required>
          <Controller name="producto_id" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
              <SelectContent>
                {productosActivos.map((p) => {
                  const variedadLabel = p.variedad === 'snow_peas' ? 'Snow Peas' : 'Sugar Snap'
                  const produccionLabel = p.tipo_produccion === 'organico' ? 'Orgánico' : 'Convencional'
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} · {p.nombre} · {variedadLabel} · {produccionLabel}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Centro de acopio" error={errors.centro_acopio_id?.message} required>
          <Controller name="centro_acopio_id" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Seleccionar centro..." /></SelectTrigger>
              <SelectContent>
                {centrosActivos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Peso bruto (kg)" error={errors.peso_bruto_kg?.message} required>
          <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...register('peso_bruto_kg', { valueAsNumber: true })} />
        </FormField>

        <FormField label="Tara por jaba (kg)" error={errors.peso_tara_kg?.message} required>
          <Controller name="peso_tara_kg" control={control} render={({ field }) => (
            <Select
              onValueChange={(val) => field.onChange(Number(val))}
              value={field.value != null ? String(field.value) : ''}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {[1.3, 1.8, 2].map((v) => (
                  <SelectItem key={v} value={String(v)}>{v % 1 === 0 ? `${v}.0` : v.toFixed(1)} kg</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Peso neto (kg)" error={errors.peso_neto_kg?.message} required>
          <Input
            type="number"
            step="0.01"
            readOnly
            aria-disabled="true"
            className="cursor-not-allowed border-dashed bg-muted text-foreground"
            {...register('peso_neto_kg', { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Jabas ingresadas" error={errors.num_cubetas?.message} required>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            {...register('num_cubetas', {
              setValueAs: (value) => value === '' ? 0 : Number(value),
            })}
          />
        </FormField>

        <FormField label="Peso por jaba (kg)">
          <Input
            type="number"
            step="0.01"
            value={pesoPorJaba.toFixed(2)}
            readOnly
            aria-disabled="true"
            className="cursor-not-allowed border-dashed bg-muted text-foreground"
          />
        </FormField>

        <FormField label="Jabas prestadas (por devolver)" error={errors.jabas_prestadas?.message}>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            {...register('jabas_prestadas', {
              setValueAs: (value) => value === '' ? 0 : Number(value),
            })}
          />
        </FormField>
      </div>

      <FormField label="Observaciones" error={errors.observaciones?.message}>
        <Textarea placeholder="Notas del lote..." rows={2} {...register('observaciones')} />
      </FormField>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>{isEditing ? 'Guardar cambios' : 'Registrar lote'}</Button>
      </div>
    </form>
  )
}
