import { Badge } from '@/components/ui/badge'
import {
  ESTADO_LOTE_CONFIG,
  ESTADO_LIQUIDACION_CONFIG,
  CATEGORIA_CLASIFICACION_CONFIG,
  TIPO_MOVIMIENTO_CUBETA_CONFIG,
} from '@/constants'
import type { EstadoLote, EstadoLiquidacion, CategoriaClasificacion, TipoMovimientoCubeta } from '@/types/models'

interface EstadoLoteBadgeProps { estado: EstadoLote }
export function EstadoLoteBadge({ estado }: EstadoLoteBadgeProps) {
  const config = ESTADO_LOTE_CONFIG[estado]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>{config.label}</span>
}

interface EstadoLiquidacionBadgeProps { estado: EstadoLiquidacion }
export function EstadoLiquidacionBadge({ estado }: EstadoLiquidacionBadgeProps) {
  const config = ESTADO_LIQUIDACION_CONFIG[estado]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>{config.label}</span>
}

interface CategoriaClasificacionBadgeProps { categoria: CategoriaClasificacion }
export function CategoriaClasificacionBadge({ categoria }: CategoriaClasificacionBadgeProps) {
  const config = CATEGORIA_CLASIFICACION_CONFIG[categoria]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>{config.label}</span>
}

interface TipoMovimientoBadgeProps { tipo: TipoMovimientoCubeta }
export function TipoMovimientoBadge({ tipo }: TipoMovimientoBadgeProps) {
  const config = TIPO_MOVIMIENTO_CUBETA_CONFIG[tipo]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>{config.label}</span>
}

interface EstadoActivoBadgeProps { estado: 'activo' | 'inactivo' }
export function EstadoActivoBadge({ estado }: EstadoActivoBadgeProps) {
  return (
    <Badge variant={estado === 'activo' ? 'success' : 'secondary'}>
      {estado === 'activo' ? 'Activo' : 'Inactivo'}
    </Badge>
  )
}
