import type { BaseEntity, EstadoActivo, UUID } from './common'

// ─────────────────────────────────────────────
// AGRICULTOR
// ─────────────────────────────────────────────
export interface Agricultor extends BaseEntity {
  codigo: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  numero_cuenta: string | null
  fecha_alta: string
  ubicacion: string | null
  estado: EstadoActivo
}

export type AgricultorInsert = Omit<Agricultor, keyof BaseEntity>
export type AgricultorUpdate = Partial<AgricultorInsert>

export interface AgricultorSublote extends BaseEntity {
  agricultor_id: UUID
  nombre: string
}

export type AgricultorSubloteInsert = Omit<AgricultorSublote, keyof BaseEntity>
export type AgricultorSubloteUpdate = Partial<AgricultorSubloteInsert>

export interface Acopiador extends BaseEntity {
  codigo: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  numero_cuenta: string | null
  fecha_alta: string
  ubicacion: string | null
  estado: EstadoActivo
}

export type AcopiadorInsert = Omit<Acopiador, keyof BaseEntity>
export type AcopiadorUpdate = Partial<AcopiadorInsert>

export type RolColaborador = 'recepcionista' | 'seleccionador' | 'empaquetador'

export interface Colaborador extends BaseEntity {
  codigo: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  numero_cuenta: string | null
  fecha_alta: string
  ubicacion: string | null
  rol: RolColaborador
  estado: EstadoActivo
}

export type ColaboradorInsert = Omit<Colaborador, keyof BaseEntity>
export type ColaboradorUpdate = Partial<ColaboradorInsert>

// ─────────────────────────────────────────────
// PRODUCTO
// ─────────────────────────────────────────────
export type VariedadProducto = 'snow_peas' | 'sugar'
export type CalidadProducto = 'cat1' | 'cat2'
export type TipoProduccion = 'organico' | 'convencional'

export interface Producto extends BaseEntity {
  codigo: string
  nombre: string
  variedad: VariedadProducto
  calidad: CalidadProducto
  tipo_produccion: TipoProduccion
}

export type ProductoInsert = Omit<Producto, keyof BaseEntity>
export type ProductoUpdate = Partial<ProductoInsert>

// ─────────────────────────────────────────────
// CENTRO DE ACOPIO
// ─────────────────────────────────────────────
export interface CentroAcopio extends BaseEntity {
  codigo: string
  nombre: string
  ubicacion: string | null
  responsable: string | null
  estado: EstadoActivo
}

export type CentroAcopioInsert = Omit<CentroAcopio, keyof BaseEntity>
export type CentroAcopioUpdate = Partial<CentroAcopioInsert>

// ─────────────────────────────────────────────
// LOTE
// ─────────────────────────────────────────────
export type EstadoLote =
  | 'ingresado'
  | 'en_clasificacion'
  | 'clasificado'
  | 'empaquetado'
  | 'en_despacho'
  | 'despachado'
  | 'liquidado'

export interface Lote extends BaseEntity {
  codigo: string
  agricultor_id: UUID
  recepcionista_id: UUID | null
  acopiador_id: UUID | null
  acopiador_agricultor_id: UUID | null
  producto_id: UUID
  centro_acopio_id: UUID
  fecha_ingreso: string           // ISO date
  fecha_cosecha: string           // ISO date
  peso_bruto_kg: number
  peso_tara_kg: number
  peso_neto_kg: number
  num_cubetas: number
  jabas_prestadas: number
  codigo_lote_agricultor: string | null
  sublote: string | null
  observaciones: string | null
  estado: EstadoLote
  // relaciones (join)
  agricultor?: Agricultor
  recepcionista?: Colaborador
  acopiador?: Acopiador
  acopiador_agricultor?: Agricultor
  producto?: Producto
  centro_acopio?: CentroAcopio
}

export type LoteInsert = Omit<Lote, keyof BaseEntity | 'agricultor' | 'recepcionista' | 'acopiador' | 'acopiador_agricultor' | 'producto' | 'centro_acopio'>
export type LoteUpdate = Partial<LoteInsert>

// ─────────────────────────────────────────────
// CLASIFICACIÓN
// ─────────────────────────────────────────────
// Mantenemos el tipo para compatibilidad con liquidaciones_agri_detalle
export type CategoriaClasificacion = 'primera' | 'segunda' | 'descarte'

/** Sesión de clasificación: una por lote */
export interface Clasificacion extends BaseEntity {
  lote_id: UUID
  fecha_clasificacion: string
  peso_bueno_kg: number
  observaciones: string | null
  // relaciones
  lote?: Lote
  aportes?: ClasificacionAporte[]
  mesas?: ClasificacionMesa[]
}

export type ClasificacionInsert = Omit<Clasificacion, keyof BaseEntity | 'lote' | 'aportes'>
export type ClasificacionUpdate = Partial<ClasificacionInsert>

/** Aporte de un seleccionador dentro de una sesión de clasificación */
export interface ClasificacionAporte extends BaseEntity {
  clasificacion_id: UUID
  colaborador_id: UUID
  peso_bueno_kg: number
  kg_cat1: number
  kg_cat2: number
  kg_bruto: number
  num_jabas: number
  peso_tara_kg: number
  jabas_descartadas: number
  kg_bruto_descartable: number
  peso_tara_descartable_kg: number
  kg_neto_descartable: number
  // relaciones
  colaborador?: Colaborador
}

export type ClasificacionAporteInsert = Omit<ClasificacionAporte, keyof BaseEntity | 'colaborador'>
export type ClasificacionAporteUpdate = Partial<ClasificacionAporteInsert>

/** Mesa participante en una sesión de clasificación */
export interface ClasificacionMesa extends BaseEntity {
  clasificacion_id: UUID
  nombre: string
  num_jabas: number
}

export type ClasificacionMesaInsert = Omit<ClasificacionMesa, keyof BaseEntity>
export type ClasificacionMesaUpdate = Partial<ClasificacionMesaInsert>

// ─────────────────────────────────────────────
// EMPAQUETADO
// ─────────────────────────────────────────────
export type DestinoEmpaquetado = 'europa' | 'usa'

export interface Empaquetado extends BaseEntity {
  lote_id: UUID
  colaborador_id: UUID | null
  fecha_empaquetado: string
  destino: DestinoEmpaquetado
  codigo_trazabilidad: string
  numero_pallet: string
  num_cajas: number
  observaciones: string | null
  lote?: Lote
  colaborador?: Colaborador
}

export type EmpaquetadoInsert = Omit<Empaquetado, keyof BaseEntity | 'lote'>
export type EmpaquetadoUpdate = Partial<EmpaquetadoInsert>

// ─────────────────────────────────────────────
// DESPACHO
// ─────────────────────────────────────────────
export type DestinoDespacho = 'exportacion' | 'mercado_local' | 'planta_proceso'
export type TipoDespacho = 'maritima' | 'aerea' | 'terrestre'

export interface Despacho extends BaseEntity {
  codigo: string
  lote_id: UUID | null
  fecha_despacho: string
  destino: DestinoDespacho
  tipo_despacho: TipoDespacho
  exportador: string | null
  marca_caja: string | null
  transportista: string | null
  placa_vehiculo: string | null
  num_cajas_despachadas: number
  peso_neto_kg: number
  observaciones: string | null
  // relaciones
  lote?: Lote
  pallets?: DespachoPallet[]
}

export interface DespachoPallet extends BaseEntity {
  despacho_id: UUID
  lote_id: UUID
  numero_pallet: string
  num_cajas: number
  lote?: Lote
  despacho?: Despacho
}

export type DespachoInsert = Omit<Despacho, keyof BaseEntity | 'codigo' | 'lote' | 'pallets'>
export type DespachoUpdate = Partial<DespachoInsert>
export type DespachoPalletInsert = Omit<DespachoPallet, keyof BaseEntity | 'lote' | 'despacho'>

// ─────────────────────────────────────────────
// LIQUIDACIÓN AGRICULTOR
// ─────────────────────────────────────────────
export type EstadoLiquidacion = 'borrador' | 'confirmada' | 'pagada'
export type ModalidadPago = 'transferencia' | 'yape_plin' | 'efectivo'

export interface LiquidacionAgri extends BaseEntity {
  codigo: string
  agricultor_id: UUID
  fecha_inicio: string
  fecha_fin: string
  total_kg: number
  total_monto: number
  estado: EstadoLiquidacion
  observaciones: string | null
  fecha_pago: string | null
  numero_operacion: string | null
  modalidad_pago: ModalidadPago | null
  // relaciones
  agricultor?: Agricultor
  detalles?: LiquidacionAgriDetalle[]
}

export interface LiquidacionAgriDetalle extends BaseEntity {
  liquidacion_id: UUID
  lote_id: UUID
  categoria: CategoriaClasificacion
  peso_kg: number
  precio_kg: number
  subtotal: number
  // relaciones
  lote?: Lote
}

export type LiquidacionAgriInsert = Omit<LiquidacionAgri, keyof BaseEntity | 'agricultor' | 'detalles' | 'fecha_pago' | 'numero_operacion' | 'modalidad_pago'> & {
  fecha_pago?: string | null
  numero_operacion?: string | null
  modalidad_pago?: ModalidadPago | null
}
export type LiquidacionAgriUpdate = Partial<LiquidacionAgriInsert>

export type LiquidacionAgriDetalleInsert = Omit<LiquidacionAgriDetalle, keyof BaseEntity | 'lote'>

// ─────────────────────────────────────────────
// PLANILLA QUINCENAL (Módulo 9 PDF)
// ─────────────────────────────────────────────
export type EstadoPlanilla = 'borrador' | 'confirmada' | 'pagada'

export interface PlanillaQuincenal extends BaseEntity {
  periodo_inicio: string   // ISO date (ej. 2026-04-01)
  periodo_fin: string      // ISO date (ej. 2026-04-15)
  total_monto: number
  estado: EstadoPlanilla
  observaciones: string | null
  fecha_pago: string | null
  numero_operacion: string | null
  modalidad_pago: ModalidadPago | null
  // relaciones
  detalles?: PlanillaDetalle[]
}

export type PlanillaQuincenalInsert = Omit<PlanillaQuincenal, keyof BaseEntity | 'detalles' | 'fecha_pago' | 'numero_operacion' | 'modalidad_pago'> & {
  fecha_pago?: string | null
  numero_operacion?: string | null
  modalidad_pago?: ModalidadPago | null
}
export type PlanillaQuincenalUpdate = Partial<PlanillaQuincenalInsert>

export interface PlanillaDetalle extends BaseEntity {
  planilla_id: UUID
  colaborador_id: UUID
  kg_bruto_recepcion: number      // Kg brutos recepcionados en lotes del período
  pago_recepcion: number          // kg_bruto_recepcion * tarifa recepción
  kg_cat1_seleccion: number       // Tareo A — kg seleccionados Cat 1
  kg_cat2_seleccion: number       // Tareo A — kg seleccionados Cat 2
  pago_seleccion: number          // kg_cat1 × 0.20 + kg_cat2 × 0.28
  n_cajas_empaquetado: number     // Módulo 6 / Tareo D — S/ 0.32 / caja
  monto_empaquetado: number       // n_cajas * 0.32
  otros_montos: number            // jornal, adelantos, descuentos, etc.
  total: number
  // relaciones
  colaborador?: Colaborador
}

export type PlanillaDetalleInsert = Omit<PlanillaDetalle, keyof BaseEntity | 'colaborador'>
export type PlanillaDetalleUpdate = Partial<PlanillaDetalleInsert>

// ─────────────────────────────────────────────
// CONFIGURACIÓN DE PRECIOS
// ─────────────────────────────────────────────
export interface ConfigPrecio extends BaseEntity {
  semana: number
  anio: number
  variedad: VariedadProducto
  categoria: CalidadProducto
  precio_kg_sol: number
}

export type ConfigPrecioInsert = Omit<ConfigPrecio, keyof BaseEntity>
export type ConfigPrecioUpdate = Partial<ConfigPrecioInsert>

export interface ConfigSistema extends BaseEntity {
  clave: string
  nombre: string
  descripcion: string | null
  valor_texto: string | null
  valor_numerico: number | null
}

export type ConfigSistemaInsert = Omit<ConfigSistema, keyof BaseEntity>
export type ConfigSistemaUpdate = Partial<ConfigSistemaInsert>

// ─────────────────────────────────────────────
// MOVIMIENTO DE CUBETAS
// ─────────────────────────────────────────────
export type TipoMovimientoCubeta = 'entrega' | 'devolucion'

export interface MovimientoCubeta extends BaseEntity {
  agricultor_id: UUID
  lote_id: UUID | null
  tipo: TipoMovimientoCubeta
  cantidad: number
  fecha: string
  observaciones: string | null
  // relaciones
  agricultor?: Agricultor
  lote?: Lote
}

export type MovimientoCubetaInsert = Omit<MovimientoCubeta, keyof BaseEntity | 'agricultor' | 'lote'>
export type MovimientoCubetaUpdate = Partial<MovimientoCubetaInsert>

// ─────────────────────────────────────────────
// BALANCE DE CUBETAS (virtual, calculado)
// ─────────────────────────────────────────────
export interface BalanceCubetaAgri {
  agricultor_id: UUID
  agricultor?: Agricultor
  total_entregadas: number
  total_devueltas: number
  saldo_pendiente: number
}
