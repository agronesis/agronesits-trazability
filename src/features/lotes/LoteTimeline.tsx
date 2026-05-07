import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { ESTADO_LOTE_CONFIG } from '@/constants'
import type { EstadoLote } from '@/types/models'
import { cn } from '@/lib/utils'

const PASOS: EstadoLote[] = [
  'ingresado', 'en_clasificacion', 'clasificado',
  'empaquetado', 'en_despacho', 'despachado', 'liquidado',
]

interface LoteTimelineProps {
  estadoActual: EstadoLote
}

// Estados que representan una fase EN PROCESO (reloj ámbar)
// Los demás estados son terminales de su fase → se muestran como completados (verde)
const ESTADOS_EN_PROGRESO = new Set<EstadoLote>(['en_clasificacion', 'en_despacho'])

export function LoteTimeline({ estadoActual }: LoteTimelineProps) {
  const indexActual = PASOS.indexOf(estadoActual)
  const isInProgress = ESTADOS_EN_PROGRESO.has(estadoActual)

  return (
    <div className="flex flex-col gap-0">
      {PASOS.map((paso, i) => {
        const esFinal = i === PASOS.length - 1
        // completado = paso anterior al actual, O es el paso actual y NO está "en progreso"
        const completado = i < indexActual || (i === indexActual && (!isInProgress || esFinal))
        // activo = es el paso actual Y está en progreso Y no es el final
        const activo = i === indexActual && isInProgress && !esFinal
        const { label } = ESTADO_LOTE_CONFIG[paso]

        return (
          <div key={paso} className="flex items-start gap-3">
            {/* Ícono + línea vertical */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-colors',
                completado && 'bg-emerald-600 border-emerald-600 text-white',
                activo && 'bg-amber-500 border-amber-500 text-white',
                !completado && !activo && 'border-slate-300 bg-slate-50 text-slate-400'
              )}>
                {completado ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : activo ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              {i < PASOS.length - 1 && (
                <div className={cn('w-0.5 h-6 mt-0.5', completado ? 'bg-emerald-500' : 'bg-slate-200')} />
              )}
            </div>

            {/* Etiqueta */}
            <div className="pt-1 pb-4">
              <p className={cn(
                'text-sm font-medium',
                completado && 'text-emerald-700',
                activo && 'text-amber-700 font-semibold',
                !completado && !activo && 'text-slate-500'
              )}>
                {label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
