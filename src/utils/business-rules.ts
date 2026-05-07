import { TRANSICIONES_LOTE } from '@/constants'
import type { EstadoLote } from '@/types/models'
import type { CategoriaClasificacion, Clasificacion, Despacho } from '@/types/models'

// ─────────────────────────────────────────────
// CONSTANTES DE PROCESO (Módulos 6 y 7 del PDF)
// Fallbacks por defecto cuando aún no existe configuración en DB
// ─────────────────────────────────────────────
export const DEFAULT_PESO_CAJA_EXPORTACION_KG = 4.65
export const DEFAULT_PESO_CAJA_DESPACHO_KG = 4.5
export const CAJAS_POR_PALLET = 172
export const MAX_PALLETS_POR_DESPACHO_MAR_AER = 20
export const MAX_CAJAS_DESPACHO_MAR_AER = CAJAS_POR_PALLET * MAX_PALLETS_POR_DESPACHO_MAR_AER
/** 3% del peso neto que corresponde al socio Alan Melendrez (Módulo 1 PDF) */
export const PCT_ALAN_MELENDREZ = 0.03
/** Tarifa de pago al seleccionador por kg procesado Cat 1 (S/ 0.20/kg) */
export const PRECIO_SELECCION_CAT1 = 0.20
/** Tarifa de pago al seleccionador por kg procesado Cat 2 (S/ 0.28/kg) */
export const PRECIO_SELECCION_CAT2 = 0.28
/** Tarifa de pago al empacador por caja completada (S/ 0.32/caja) */
export const PRECIO_EMPAQUE_CAJA = 0.32
/** Valor por defecto configurable para pago al empaquetador por caja (S/ 0.32/caja) */
export const DEFAULT_PAGO_EMPAQUETADO_CAJA = 0.32
/** Tarifa de pago al recepcionista por kg bruto recepcionado (S/ 0.02/kg) */
export const DEFAULT_PAGO_RECEPCION_KG = 0.02

export function normalizarNumeroPallet(value: string): string {
  const trimmed = value.trim()
  if (!/^\d{1,3}$/.test(trimmed)) return trimmed
  const numero = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(numero) || numero <= 0 || numero > 999) return trimmed
  return String(numero).padStart(3, '0')
}

/**
 * Calcula el peso neto promedio por jaba de un lote.
 * Si no hay jabas registradas, retorna 0 para evitar divisiones inválidas.
 */
export function calcularPesoPorJaba(pesoNetoKg: number, numJabas: number): number {
  if (!Number.isFinite(pesoNetoKg) || !Number.isFinite(numJabas) || numJabas <= 0) return 0
  return Math.round((pesoNetoKg / numJabas) * 100) / 100
}

/**
 * Calcula el peso neto que corresponde al agricultor: descuenta 3% de Alan Melendrez.
 * Resultado redondeado a 2 decimales.
 */
export function calcularPesoAgricultor(pesoKgBuenos: number): number {
  return Math.round(pesoKgBuenos * (1 - PCT_ALAN_MELENDREZ) * 100) / 100
}

/**
 * Calcula el pago a un seleccionador dado los kg buenos y la calidad del lote.
 * Cat1: S/ 0.20/kg, Cat2: S/ 0.28/kg
 */
export function calcularPagoSeleccionador(kgBueno: number, calidad: 'cat1' | 'cat2'): number {
  const precio = calidad === 'cat1' ? PRECIO_SELECCION_CAT1 : PRECIO_SELECCION_CAT2
  return Math.round(kgBueno * precio * 100) / 100
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: LOTES Y ESTADOS
// ─────────────────────────────────────────────

/**
 * Verifica si una transición de estado de lote es válida
 */
export function puedeTransicionarLote(
  estadoActual: EstadoLote,
  nuevoEstado: EstadoLote
): boolean {
  const permitidos = TRANSICIONES_LOTE[estadoActual] ?? []
  return permitidos.includes(nuevoEstado)
}

/**
 * Retorna el próximo estado válido de un lote
 */
export function siguienteEstadoLote(estadoActual: EstadoLote): EstadoLote | null {
  const permitidos = TRANSICIONES_LOTE[estadoActual]
  if (!permitidos || permitidos.length === 0) return null
  return permitidos[0] as EstadoLote
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: CLASIFICACIONES
// ─────────────────────────────────────────────

/**
 * Calcula el número de cajas exportables a partir de los kg buenos clasificados.
 * Divide por el peso objetivo por caja (4.65 kg).
 * Siempre redondeado hacia abajo — no se puede empacar media caja.
 */
export function calcularCajasExportables(
  pesoKgBuenos: number,
  pesoCajaKg: number = DEFAULT_PESO_CAJA_EXPORTACION_KG
): number {
  return Math.floor(pesoKgBuenos / pesoCajaKg)
}

/**
 * Calcula pallets completos y cajas restantes a partir del total de cajas.
 */
export function calcularPallets(nCajas: number): { completos: number; restantes: number } {
  return {
    completos: Math.floor(nCajas / CAJAS_POR_PALLET),
    restantes: nCajas % CAJAS_POR_PALLET,
  }
}

export function calcularPesoNetoDespacho(
  numCajas: number,
  pesoCajaKg: number = DEFAULT_PESO_CAJA_DESPACHO_KG
): number {
  return Math.round(numCajas * pesoCajaKg * 100) / 100
}

/**
 * Retorna totales por "categoría" compatibles con el módulo de liquidaciones.
 * Con el nuevo modelo, "primera" = kg buenos totales de la sesión.
 * num_cajas se calcula aplicando ajuste por deshidratación y dividiendo por peso/caja.
 */
export function calcularTotalesClasificacion(
  clasificaciones: Clasificacion[],
  pesoCajaKg: number = DEFAULT_PESO_CAJA_EXPORTACION_KG
): Record<CategoriaClasificacion, { peso_kg: number; num_cajas: number }> {
  const totalBuenos = clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
  return {
    primera:  { peso_kg: totalBuenos, num_cajas: calcularCajasExportables(totalBuenos, pesoCajaKg) },
    segunda:  { peso_kg: 0,           num_cajas: 0 },
    descarte: { peso_kg: 0,           num_cajas: 0 },
  }
}

/**
 * Calcula el total de kg buenos de un lote (suma de sessions).
 */
export function calcularPesoTotalClasificado(clasificaciones: Clasificacion[]): number {
  return clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: LIQUIDACIONES
// ─────────────────────────────────────────────

/**
 * Calcula el subtotal de una línea de liquidación
 */
export function calcularSubtotalLiquidacion(pesoKg: number, precioKg: number): number {
  return Math.round(pesoKg * precioKg * 100) / 100
}

/**
 * Calcula el total de una liquidación agri a partir de sus detalles
 */
export function calcularTotalLiquidacionAgri(
  detalles: Array<{ peso_kg: number; precio_kg: number }>
): { total_kg: number; total_monto: number } {
  const total_kg = detalles.reduce((acc, d) => acc + d.peso_kg, 0)
  const total_monto = detalles.reduce(
    (acc, d) => acc + calcularSubtotalLiquidacion(d.peso_kg, d.precio_kg),
    0
  )
  return {
    total_kg: Math.round(total_kg * 100) / 100,
    total_monto: Math.round(total_monto * 100) / 100,
  }
}

/**
 * Calcula el total de una liquidación de personal
 */
export function calcularTotalActividades(
  actividades: Array<{ cantidad_unidades: number; tarifa_unitaria: number }>
): { total_unidades: number; total_monto: number } {
  const total_unidades = actividades.reduce((acc, a) => acc + a.cantidad_unidades, 0)
  const total_monto = actividades.reduce(
    (acc, a) => acc + a.cantidad_unidades * a.tarifa_unitaria,
    0
  )
  return {
    total_unidades,
    total_monto: Math.round(total_monto * 100) / 100,
  }
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: CUBETAS
// ─────────────────────────────────────────────

/**
 * Calcula el saldo pendiente de cubetas de un agricultor
 */
export function calcularSaldoCubetas(
  movimientos: Array<{ tipo: 'entrega' | 'devolucion'; cantidad: number }>
): { total_entregadas: number; total_devueltas: number; saldo_pendiente: number } {
  const total_entregadas = movimientos
    .filter((m) => m.tipo === 'entrega')
    .reduce((acc, m) => acc + m.cantidad, 0)

  const total_devueltas = movimientos
    .filter((m) => m.tipo === 'devolucion')
    .reduce((acc, m) => acc + m.cantidad, 0)

  return {
    total_entregadas,
    total_devueltas,
    saldo_pendiente: total_entregadas - total_devueltas,
  }
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: DESPACHO
// ─────────────────────────────────────────────

/**
 * Valida que el despacho no supere las cajas exportables disponibles (ya descontando despachos anteriores).
 */
export function validarCajasDespacho(
  cajasDisponibles: number,
  cajasADespachar: number
): string | null {
  if (cajasADespachar > cajasDisponibles) {
    return `Las cajas a despachar (${cajasADespachar}) superan las disponibles (${cajasDisponibles})`
  }
  return null
}

export function validarLimiteCajasPorTipoDespacho(
  tipoDespacho: Despacho['tipo_despacho'],
  cajasADespachar: number
): string | null {
  if ((tipoDespacho === 'maritima' || tipoDespacho === 'aerea') && cajasADespachar > MAX_CAJAS_DESPACHO_MAR_AER) {
    return `El despacho ${tipoDespacho === 'maritima' ? 'marítimo' : 'aéreo'} no puede exceder ${MAX_CAJAS_DESPACHO_MAR_AER} cajas.`
  }
  return null
}
