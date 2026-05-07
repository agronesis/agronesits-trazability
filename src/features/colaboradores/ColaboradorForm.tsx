import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { colaboradorSchema, type ColaboradorFormData } from '@/utils/validators'
import { ROL_COLABORADOR_CONFIG } from '@/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'

type ColaboradorFormInput = z.input<typeof colaboradorSchema>

interface ColaboradorFormProps {
  defaultValues?: Partial<ColaboradorFormData>
  onSubmit: (data: ColaboradorFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function ColaboradorForm({ defaultValues, onSubmit, onCancel, isEditing }: ColaboradorFormProps) {
  const normalizedDefaults = useMemo<Partial<ColaboradorFormInput>>(() => ({
    estado: 'activo',
    rol: 'recepcionista',
    codigo: defaultValues?.codigo ?? 'AUTO',
    ...defaultValues,
    dni: defaultValues?.dni ?? '',
    telefono: defaultValues?.telefono ?? '',
    numero_cuenta: defaultValues?.numero_cuenta ?? '',
    fecha_alta: defaultValues?.fecha_alta ?? new Date().toISOString().slice(0, 10),
    ubicacion: defaultValues?.ubicacion ?? '',
  }), [defaultValues])

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ColaboradorFormInput>({
    resolver: zodResolver(colaboradorSchema) as any,
    defaultValues: normalizedDefaults,
  })

  useEffect(() => {
    reset(normalizedDefaults)
  }, [normalizedDefaults, reset])

  const handleValidSubmit = async (data: ColaboradorFormInput) => {
    await onSubmit(colaboradorSchema.parse(data) as ColaboradorFormData)
  }

  return (
    <form onSubmit={handleSubmit(handleValidSubmit as any)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Codigo" error={errors.codigo?.message} required>
          {isEditing ? (
            <>
              <Input
                value={defaultValues?.codigo ?? ''}
                disabled
                placeholder="COL-000001"
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
                placeholder="Se asigna automaticamente al guardar"
                className="cursor-not-allowed border-dashed bg-muted text-muted-foreground placeholder:text-muted-foreground/90"
              />
              <Input type="hidden" {...register('codigo')} />
            </>
          )}
        </FormField>

        <FormField label="Estado" error={errors.estado?.message} required>
          <Controller
            name="estado"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField label="Nombre" error={errors.nombre?.message} required>
          <Input placeholder="Juan" {...register('nombre')} />
        </FormField>

        <FormField label="Apellido" error={errors.apellido?.message} required>
          <Input placeholder="Quispe" {...register('apellido')} />
        </FormField>

        <FormField label="Rol" error={errors.rol?.message} required>
          <Controller
            name="rol"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rol..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROL_COLABORADOR_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField label="DNI" error={errors.dni?.message}>
          <Input placeholder="12345678" maxLength={8} {...register('dni')} />
        </FormField>

        <FormField label="Telefono" error={errors.telefono?.message}>
          <Input placeholder="987 654 321" {...register('telefono')} />
        </FormField>

        <FormField label="N° cuenta" error={errors.numero_cuenta?.message}>
          <Input placeholder="0011-0234-0001234567" {...register('numero_cuenta')} />
        </FormField>

        <FormField label="Fecha de alta" error={errors.fecha_alta?.message} required>
          <Input type="date" {...register('fecha_alta')} />
        </FormField>
      </div>

      <FormField label="Ubicacion" error={errors.ubicacion?.message}>
        <Textarea placeholder="Sector, direccion o referencia..." rows={2} {...register('ubicacion')} />
      </FormField>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEditing ? 'Guardar cambios' : 'Registrar colaborador'}
        </Button>
      </div>
    </form>
  )
}