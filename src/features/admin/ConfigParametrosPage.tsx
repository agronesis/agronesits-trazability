import { useState, useEffect, useRef } from 'react'
import { z } from 'zod'
import { logAudit } from '@/services/audit.service'
import {
  getConfigSistemaPorClave,
  upsertConfigSistemaNumerico,
  CLAVE_PESO_CAJA_EXPORTACION,
  CLAVE_PESO_CAJA_DESPACHO,
  CLAVE_PAGO_RECEPCION_KG,
  CLAVE_PAGO_EMPAQUETADO_CAJA,
} from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { FormField } from '@/components/shared/FormField'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import { DEFAULT_PAGO_RECEPCION_KG, DEFAULT_PESO_CAJA_DESPACHO_KG, DEFAULT_PESO_CAJA_EXPORTACION_KG, DEFAULT_PAGO_EMPAQUETADO_CAJA } from '@/utils/business-rules'

const parametroCajaSchema = z.object({
  peso_caja_exportacion_kg: z.number({ message: 'Ingrese un número' }).positive().max(100),
  peso_caja_despacho_kg: z.number({ message: 'Ingrese un número' }).positive().max(100),
  pago_recepcion_kg: z.number({ message: 'Ingrese un número' }).nonnegative().max(100),
  pago_empaquetado_caja: z.number({ message: 'Ingrese un número' }).nonnegative().max(100),
})

type ParametroCajaFormData = z.infer<typeof parametroCajaSchema>
type ParametroKey = keyof ParametroCajaFormData

const PARAMETRO_CAJA_CONFIG: Record<ParametroKey, {
  clave: string
  nombre: string
  descripcion: string
  label: string
  helper: string
  min: number
  step: string
  placeholder: string
}> = {
  peso_caja_exportacion_kg: {
    clave: CLAVE_PESO_CAJA_EXPORTACION,
    nombre: 'Peso por caja de exportación',
    descripcion: 'Peso objetivo en kg usado para convertir kg buenos clasificados a cajas exportables.',
    label: 'Peso por caja exportación (kg)',
    helper: 'Afecta cálculo de cajas exportables en clasificación y empaquetado.',
    min: 0.01,
    step: '0.01',
    placeholder: '4.65',
  },
  peso_caja_despacho_kg: {
    clave: CLAVE_PESO_CAJA_DESPACHO,
    nombre: 'Peso por caja de despacho',
    descripcion: 'Peso en kg por caja usado para calcular el peso neto total de los despachos.',
    label: 'Peso por caja despacho (kg)',
    helper: 'Afecta cálculo del peso neto en despachos.',
    min: 0.01,
    step: '0.01',
    placeholder: '4.50',
  },
  pago_recepcion_kg: {
    clave: CLAVE_PAGO_RECEPCION_KG,
    nombre: 'Pago recepción por kg bruto',
    descripcion: 'Tarifa por kg bruto recepcionado usada en la planilla quincenal.',
    label: 'Tarifa recepción (S/./kg)',
    helper: 'Afecta el cálculo de pagos en la planilla quincenal.',
    min: 0,
    step: '0.01',
    placeholder: '0.02',
  },
  pago_empaquetado_caja: {
    clave: CLAVE_PAGO_EMPAQUETADO_CAJA,
    nombre: 'Pago empaquetado por caja',
    descripcion: 'Tarifa por caja empaquetada usada en la planilla quincenal (Tareo D).',
    label: 'Tarifa empaquetado (S/./caja)',
    helper: 'Afecta el cálculo de pagos en la planilla quincenal.',
    min: 0,
    step: '0.01',
    placeholder: '0.32',
  },
}

export default function ConfigParametrosPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [parametroError, setParametroError] = useState<string | null>(null)
  const [parametroSuccess, setParametroSuccess] = useState<string | null>(null)
  const [guardandoParametro, setGuardandoParametro] = useState<ParametroKey | null>(null)
  const [parametros, setParametros] = useState<ParametroCajaFormData>({
    peso_caja_exportacion_kg: DEFAULT_PESO_CAJA_EXPORTACION_KG,
    peso_caja_despacho_kg: DEFAULT_PESO_CAJA_DESPACHO_KG,
    pago_recepcion_kg: DEFAULT_PAGO_RECEPCION_KG,
    pago_empaquetado_caja: DEFAULT_PAGO_EMPAQUETADO_CAJA,
  })
  const [parametroFieldErrors, setParametroFieldErrors] = useState<Partial<Record<ParametroKey, string>>>({})
  const [parametroPendienteConfirmacion, setParametroPendienteConfirmacion] = useState<ParametroKey | null>(null)
  // Track last-saved values to use as datos_anteriores in audit
  const parametrosGuardados = useRef<ParametroCajaFormData>({
    peso_caja_exportacion_kg: DEFAULT_PESO_CAJA_EXPORTACION_KG,
    peso_caja_despacho_kg: DEFAULT_PESO_CAJA_DESPACHO_KG,
    pago_recepcion_kg: DEFAULT_PAGO_RECEPCION_KG,
    pago_empaquetado_caja: DEFAULT_PAGO_EMPAQUETADO_CAJA,
  })

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [p0, p1, p2, p3] = await Promise.all([
        getConfigSistemaPorClave(CLAVE_PESO_CAJA_EXPORTACION),
        getConfigSistemaPorClave(CLAVE_PESO_CAJA_DESPACHO),
        getConfigSistemaPorClave(CLAVE_PAGO_RECEPCION_KG),
        getConfigSistemaPorClave(CLAVE_PAGO_EMPAQUETADO_CAJA),
      ])
      const loaded: ParametroCajaFormData = {
        peso_caja_exportacion_kg: Number(p0?.valor_numerico ?? DEFAULT_PESO_CAJA_EXPORTACION_KG),
        peso_caja_despacho_kg: Number(p1?.valor_numerico ?? DEFAULT_PESO_CAJA_DESPACHO_KG),
        pago_recepcion_kg: Number(p2?.valor_numerico ?? DEFAULT_PAGO_RECEPCION_KG),
        pago_empaquetado_caja: Number(p3?.valor_numerico ?? DEFAULT_PAGO_EMPAQUETADO_CAJA),
      }
      setParametros(loaded)
      parametrosGuardados.current = { ...loaded }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const guardarParametro = async (key: ParametroKey) => {
    if (!user) return

    const parsed = parametroCajaSchema.safeParse(parametros)
    if (!parsed.success) {
      const nextErrors: Partial<Record<ParametroKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ParametroKey | undefined
        if (field) nextErrors[field] = issue.message
      }
      setParametroFieldErrors(nextErrors)
      return
    }

    try {
      setGuardandoParametro(key)
      setParametroError(null)
      setParametroSuccess(null)
      setParametroFieldErrors((prev) => ({ ...prev, [key]: undefined }))

      const config = PARAMETRO_CAJA_CONFIG[key]
      const saved = await upsertConfigSistemaNumerico({
        clave: config.clave,
        nombre: config.nombre,
        descripcion: config.descripcion,
        valor_numerico: parametros[key],
      }, user.id)

      const savedValue = Number(saved.valor_numerico ?? parametros[key])

      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'config_parametros',
        registroId: config.clave,
        descripcion: `Parámetro actualizado: ${config.nombre}`,
        datosAnteriores: { clave: config.clave, valor: parametrosGuardados.current[key] },
        datosNuevos: { clave: config.clave, valor: savedValue },
      })

      parametrosGuardados.current = { ...parametrosGuardados.current, [key]: savedValue }
      setParametros((prev) => ({ ...prev, [key]: savedValue }))
      setParametroSuccess(`Guardado: ${config.label}`)
    } catch (e) {
      setParametroError((e as Error).message)
    } finally {
      setGuardandoParametro(null)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  return (
    <div>
      <PageHeader
        title="Parámetros del Sistema"
        description="Valores globales que afectan cálculos en toda la aplicación. Cada parámetro se guarda de forma independiente."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-6">
        Estos parámetros impactan directamente los cálculos de pesos, cajas exportables y pagos de planilla. Modifícalos con precaución.
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(Object.keys(PARAMETRO_CAJA_CONFIG) as ParametroKey[]).map((key) => {
          const config = PARAMETRO_CAJA_CONFIG[key]
          return (
            <div key={key} className="rounded-lg border p-4">
              <p className="text-sm font-semibold mb-0.5">{config.label}</p>
              <p className="text-xs text-muted-foreground mb-3">{config.descripcion}</p>
              <FormField label="" error={parametroFieldErrors[key]}>
                <Input
                  type="number"
                  step={config.step}
                  min={config.min}
                  placeholder={config.placeholder}
                  value={parametros[key]}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setParametros((prev) => ({ ...prev, [key]: Number.isNaN(value) ? 0 : value }))
                    setParametroFieldErrors((prev) => ({ ...prev, [key]: undefined }))
                  }}
                />
              </FormField>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{config.helper}</p>
              <Button
                type="button"
                loading={guardandoParametro === key}
                onClick={() => setParametroPendienteConfirmacion(key)}
              >
                Guardar
              </Button>
            </div>
          )
        })}
      </div>

      {parametroError && (
        <p className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {parametroError}
        </p>
      )}
      {parametroSuccess && (
        <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {parametroSuccess}
        </p>
      )}

      <ConfirmDialog
        open={!!parametroPendienteConfirmacion}
        title="¿Confirmar cambio de parámetro?"
        description={
          parametroPendienteConfirmacion
            ? `Se guardará "${PARAMETRO_CAJA_CONFIG[parametroPendienteConfirmacion].label}" con el valor ${parametros[parametroPendienteConfirmacion]}. Este cambio afectará todos los cálculos de la aplicación.`
            : ''
        }
        confirmLabel="Sí, guardar"
        variant="default"
        loading={!!parametroPendienteConfirmacion && guardandoParametro === parametroPendienteConfirmacion}
        onConfirm={() => {
          if (parametroPendienteConfirmacion) void guardarParametro(parametroPendienteConfirmacion)
          setParametroPendienteConfirmacion(null)
        }}
        onCancel={() => setParametroPendienteConfirmacion(null)}
      />
    </div>
  )
}
