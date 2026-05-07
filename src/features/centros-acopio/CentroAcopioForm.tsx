import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { centroAcopioSchema, type CentroAcopioFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'

type CentroAcopioFormInput = z.input<typeof centroAcopioSchema>

interface CentroAcopioFormProps {
  defaultValues?: Partial<CentroAcopioFormData>
  onSubmit: (data: CentroAcopioFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function CentroAcopioForm({ defaultValues, onSubmit, onCancel, isEditing }: CentroAcopioFormProps) {
  const normalizedDefaults: Partial<CentroAcopioFormInput> = {
    estado: 'activo',
    ...defaultValues,
    codigo: defaultValues?.codigo ?? 'AUTO',
    ubicacion: defaultValues?.ubicacion ?? '',
    responsable: defaultValues?.responsable ?? '',
  }

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<CentroAcopioFormInput>({
    resolver: zodResolver(centroAcopioSchema) as any,
    defaultValues: normalizedDefaults,
  })

  const handleValidSubmit = async (data: CentroAcopioFormInput) => {
    await onSubmit(centroAcopioSchema.parse(data) as CentroAcopioFormData)
  }

  return (
    <form onSubmit={handleSubmit(handleValidSubmit as any)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Código" error={errors.codigo?.message} required>
          {isEditing ? (
            <>
              <Input
                value={defaultValues?.codigo ?? ''}
                disabled
                placeholder="CA-000001"
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
        <FormField label="Estado" error={errors.estado?.message} required>
          <Controller name="estado" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Nombre" error={errors.nombre?.message} required className="sm:col-span-2">
          <Input placeholder="Centro Norte" {...register('nombre')} />
        </FormField>
        <FormField label="Responsable" error={errors.responsable?.message}>
          <Input placeholder="Nombre del responsable" {...register('responsable')} />
        </FormField>
      </div>
      <FormField label="Ubicación" error={errors.ubicacion?.message}>
        <Textarea placeholder="Dirección o referencia..." rows={2} {...register('ubicacion')} />
      </FormField>
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>{isEditing ? 'Guardar cambios' : 'Registrar centro'}</Button>
      </div>
    </form>
  )
}
