import { z } from 'zod'
import { normalizarNumeroPallet } from './business-rules'

// ─────────────────────────────────────────────
// SCHEMAS DE VALIDACIÓN REUTILIZABLES
// ─────────────────────────────────────────────

const nullableUpperTrim = (value: unknown) => {
  if (value === '' || value == null) return null
  if (typeof value !== 'string') return value
  const normalized = value.trim().toUpperCase()
  return normalized === '' ? null : normalized
}

export const dniSchema = z.preprocess(
  (v) => (v === '' || v == null ? null : (typeof v === 'string' ? v.trim() : v)),
  z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos').nullable()
)

export const telefonoSchema = z.preprocess(
  (v) => (v === '' || v == null ? null : (typeof v === 'string' ? v.trim() : v)),
  z.string().regex(/^[0-9+\s()-]{7,15}$/, 'Teléfono inválido').nullable()
)

export const codigoSchema = z
  .string()
  .trim()
  .min(2, 'El código debe tener al menos 2 caracteres')
  .max(30, 'El código no puede exceder 30 caracteres')
  .regex(/^[A-Z0-9_-]+$/, 'Solo letras, números, guión o guión bajo')
  .transform((value) => value.toUpperCase())

export const nombreSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(100, 'Máximo 100 caracteres')
  .transform((value) => value.toUpperCase())

export const pesoKgSchema = z
  .number({ message: 'Ingrese un número válido' })
  .positive('El peso debe ser mayor a 0')
  .max(50000, 'Peso fuera de rango (máx 50,000 kg)')

export const precioSchema = z
  .number({ message: 'Ingrese un número válido' })
  .nonnegative('El precio no puede ser negativo')
  .max(1000, 'Precio fuera de rango')

export const cantidadEnteraSchema = z
  .number({ message: 'Ingrese un número válido' })
  .int('Debe ser un número entero')
  .nonnegative('Debe ser mayor o igual a 0')

export const observacionesSchema = z
  .preprocess(nullableUpperTrim, z.string().max(500).nullable())

const codigoPalletSchema = z
  .string()
  .trim()
  .min(1, 'Ingrese el número de pallet')
  .regex(/^\d{1,3}$/, 'El pallet debe tener entre 1 y 3 dígitos')
  .refine((value) => {
    const numero = Number.parseInt(value, 10)
    return numero >= 1 && numero <= 999
  }, 'El pallet debe estar entre 001 y 999')
  .transform((value) => normalizarNumeroPallet(value))

// ─────────────────────────────────────────────
// SCHEMAS DE ENTIDADES
// ─────────────────────────────────────────────

export const agricultorSchema = z.object({
  codigo:    codigoSchema,
  nombre:    nombreSchema,
  apellido:  nombreSchema,
  dni:       dniSchema,
  telefono:  telefonoSchema,
  numero_cuenta: z.preprocess(nullableUpperTrim, z.string().max(50, 'Maximo 50 caracteres').nullable()),
  fecha_alta: z.string().min(1, 'Ingrese la fecha de alta'),
  ubicacion: z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  sublotes: z.array(codigoSchema).max(100, 'Demasiados sublotes').optional().default([]),
  estado:    z.enum(['activo', 'inactivo']),
})

export const acopiadorSchema = z.object({
  codigo:    codigoSchema,
  nombre:    nombreSchema,
  apellido:  nombreSchema,
  dni:       dniSchema,
  telefono:  telefonoSchema,
  numero_cuenta: z.preprocess(nullableUpperTrim, z.string().max(50, 'Maximo 50 caracteres').nullable()),
  fecha_alta: z.string().min(1, 'Ingrese la fecha de alta'),
  ubicacion: z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  estado:    z.enum(['activo', 'inactivo']),
})

export const colaboradorSchema = z.object({
  codigo:    codigoSchema,
  nombre:    nombreSchema,
  apellido:  nombreSchema,
  dni:       dniSchema,
  telefono:  telefonoSchema,
  numero_cuenta: z.preprocess(nullableUpperTrim, z.string().max(50, 'Maximo 50 caracteres').nullable()),
  fecha_alta: z.string().min(1, 'Ingrese la fecha de alta'),
  ubicacion: z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  rol:       z.enum(['recepcionista', 'seleccionador', 'empaquetador']),
  estado:    z.enum(['activo', 'inactivo']),
})

export const productoSchema = z.object({
  codigo:          codigoSchema,
  nombre:          nombreSchema,
  variedad:        z.enum(['snow_peas', 'sugar']),
  calidad:         z.enum(['cat1', 'cat2']),
  tipo_produccion: z.enum(['organico', 'convencional']),
})

export const centroAcopioSchema = z.object({
  codigo:      codigoSchema,
  nombre:      nombreSchema,
  ubicacion:   z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  responsable: z.preprocess(nullableUpperTrim, z.string().max(100).nullable()),
  estado:      z.enum(['activo', 'inactivo']),
})

export const loteSchema = z.object({
  codigo:             codigoSchema,
  agricultor_id:      z.string().uuid('Seleccione un agricultor'),
  recepcionista_id:   z.string().uuid('Seleccione un recepcionista'),
  acopiador_combined: z.string().optional().default(''),
  producto_id:        z.string().uuid('Seleccione un producto'),
  centro_acopio_id:   z.string().uuid('Seleccione un centro de acopio'),
  fecha_ingreso:    z.string().min(1, 'Ingrese la fecha de ingreso'),
  fecha_cosecha:    z.string().min(1, 'Ingrese la fecha de cosecha'),
  peso_bruto_kg:    pesoKgSchema,
  peso_tara_kg:     z
    .number({ message: 'Ingrese un número válido' })
    .nonnegative('La tara no puede ser negativa')
    .max(50000, 'Peso fuera de rango (máx 50,000 kg)'),
  peso_neto_kg:     pesoKgSchema,
  num_cubetas:      cantidadEnteraSchema,
  jabas_prestadas:  cantidadEnteraSchema,
  codigo_lote_agricultor: z.preprocess(nullableUpperTrim, z.string().max(30, 'Maximo 30 caracteres').nullable()),
  sublote: z.preprocess(nullableUpperTrim, z.string().max(30, 'Maximo 30 caracteres').nullable()),
  observaciones:    observacionesSchema,
}).superRefine((data, ctx) => {
  const totalTara = Number((data.peso_tara_kg * data.num_cubetas).toFixed(2))
  const pesoNetoEsperado = Number((data.peso_bruto_kg - totalTara).toFixed(2))

  if (totalTara >= data.peso_bruto_kg) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['peso_tara_kg'],
      message: 'La tara total (tara × jabas) debe ser menor al peso bruto',
    })
  }

  if (Math.abs(data.peso_neto_kg - pesoNetoEsperado) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['peso_neto_kg'],
      message: 'El peso neto debe coincidir con peso bruto - (tara × jabas)',
    })
  }
}).transform((data) => {
  if (!data.acopiador_combined) {
    return {
      ...data,
      acopiador_id: null,
      acopiador_agricultor_id: null,
    }
  }
  const colonIdx = data.acopiador_combined.indexOf(':')
  const type  = data.acopiador_combined.slice(0, colonIdx)
  const refId = data.acopiador_combined.slice(colonIdx + 1)
  return {
    ...data,
    acopiador_id: type === 'aco' ? refId : null,
    acopiador_agricultor_id: type === 'agri' ? refId : null,
  }
})

export const clasificacionSchema = z.object({
  lote_id:             z.string().uuid(),
  fecha_clasificacion: z.string().min(1, 'Ingrese la fecha'),
  observaciones:       observacionesSchema,
})

export const despachoSchema = z.object({
  fecha_despacho:       z.string().min(1, 'Ingrese la fecha'),
  destino:              z.enum(['exportacion', 'mercado_local', 'planta_proceso']),
  tipo_despacho:        z.enum(['maritima', 'aerea', 'terrestre']),
  exportador:           z.preprocess(nullableUpperTrim, z.string().max(120).nullable()),
  marca_caja:           z.preprocess(nullableUpperTrim, z.string().max(120).nullable()),
  transportista:        z.preprocess(nullableUpperTrim, z.string().max(100).nullable()),
  placa_vehiculo:       z.preprocess(nullableUpperTrim, z.string().max(20).nullable()),
  pallet_keys:          z.array(z.string().min(1)).min(1, 'Seleccione al menos un pallet'),
  num_cajas_despachadas: cantidadEnteraSchema,
  peso_neto_kg:         pesoKgSchema,
  observaciones:        observacionesSchema,
}).superRefine((data, ctx) => {
  if ((data.tipo_despacho === 'maritima' || data.tipo_despacho === 'aerea') && data.num_cajas_despachadas > 3440) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El despacho marítimo o aéreo no puede exceder 3440 cajas.',
      path: ['num_cajas_despachadas'],
    })
  }
})

export const empaquetadoSchema = z.object({
  lote_id: z.string().uuid(),
  colaborador_id: z.string().uuid('Seleccione un empaquetador').nullable().optional(),
  fecha_empaquetado: z.string().min(1, 'Ingrese la fecha'),
  destino: z.enum(['europa', 'usa']),
  codigo_trazabilidad: z.string().trim().min(1, 'Código de trazabilidad inválido'),
  numero_pallet: codigoPalletSchema,
  num_cajas: cantidadEnteraSchema
    .refine((value) => value > 0, 'Ingrese al menos 1 caja')
    .refine((value) => value <= 172, 'No puede exceder 172 cajas por registro'),
  observaciones: observacionesSchema,
})

export const movimientoCubetaSchema = z.object({
  agricultor_id: z.string().uuid('Seleccione un agricultor'),
  lote_id:       z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  tipo:          z.enum(['entrega', 'devolucion']),
  cantidad:      cantidadEnteraSchema.refine((v) => v > 0, 'La cantidad debe ser mayor a 0'),
  fecha:         z.string().min(1, 'Ingrese la fecha'),
  observaciones: observacionesSchema,
})

// ─────────────────────────────────────────────
// TIPOS INFERIDOS DE SCHEMAS
// ─────────────────────────────────────────────
export type AgricultorFormData       = z.infer<typeof agricultorSchema>
export type AcopiadorFormData        = z.infer<typeof acopiadorSchema>
export type ColaboradorFormData      = z.infer<typeof colaboradorSchema>
export type ProductoFormData         = z.infer<typeof productoSchema>
export type CentroAcopioFormData     = z.infer<typeof centroAcopioSchema>
export type LoteFormData             = z.infer<typeof loteSchema>
export type ClasificacionFormData    = z.infer<typeof clasificacionSchema>
export type EmpaquetadoFormData      = z.infer<typeof empaquetadoSchema>
export type DespachoFormData         = z.infer<typeof despachoSchema>
export type MovimientoCubetaFormData = z.infer<typeof movimientoCubetaSchema>
