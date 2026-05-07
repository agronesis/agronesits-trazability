import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productoSchema, type ProductoFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'

interface ProductoFormProps {
  defaultValues?: Partial<ProductoFormData>
  onSubmit: (data: ProductoFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function ProductoForm({ defaultValues, onSubmit, onCancel, isEditing }: ProductoFormProps) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ProductoFormData>({
    resolver: zodResolver(productoSchema),
    defaultValues: { codigo: defaultValues?.codigo ?? 'AUTO', variedad: 'snow_peas', calidad: 'cat1', tipo_produccion: 'convencional', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Código" error={errors.codigo?.message} required>
          {isEditing ? (
            <>
              <Input
                value={defaultValues?.codigo ?? ''}
                disabled
                placeholder="PROD-000001"
                className="cursor-not-allowed border-dashed bg-muted text-muted-foreground disabled:opacity-100"
              />
              <Input type="hidden" {...register('codigo')} />
            </>
          ) : (
            <>
              <Input
                readOnly
                aria-disabled="true"
                value=""
                placeholder="Se asigna automáticamente al guardar"
                className="cursor-not-allowed border-dashed bg-muted text-muted-foreground placeholder:text-muted-foreground/90"
              />
              <Input type="hidden" {...register('codigo')} />
            </>
          )}
        </FormField>

        <FormField label="Nombre" error={errors.nombre?.message} required className="sm:col-span-2">
          <Input placeholder="Nombre del producto" {...register('nombre')} />
        </FormField>

        <FormField label="Variedad" error={errors.variedad?.message} required>
          <Controller name="variedad" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="snow_peas">Snow Peas</SelectItem>
                <SelectItem value="sugar">Sugar Snap</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Calidad" error={errors.calidad?.message} required>
          <Controller name="calidad" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cat1">CAT 1</SelectItem>
                <SelectItem value="cat2">CAT 2</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Tipo de producción" error={errors.tipo_produccion?.message} required className="sm:col-span-2">
          <Controller name="tipo_produccion" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organico">Organico</SelectItem>
                <SelectItem value="convencional">Convencional</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>{isEditing ? 'Guardar cambios' : 'Registrar producto'}</Button>
      </div>
    </form>
  )
}
