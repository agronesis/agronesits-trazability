import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

// ─────────────────────────────────────────────
// FORMATTERS DE FECHAS
// ─────────────────────────────────────────────

export function formatFecha(fecha: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!fecha) return '—'
  const parsed = parseISO(fecha)
  if (!isValid(parsed)) return '—'
  return format(parsed, pattern, { locale: es })
}

export function formatFechaHora(fecha: string | null | undefined): string {
  return formatFecha(fecha, 'dd/MM/yyyy HH:mm')
}

export function formatQuincena(quincena: string): string {
  // Formato entrada: "2026-Q1-01" o "2026-Q2-01"
  const parts = quincena.split('-')
  if (parts.length !== 3) return quincena
  const [year, half, num] = parts
  const halfLabel = half === 'Q1' ? '1ra quincena' : '2da quincena'
  return `${halfLabel} – ${num}/${year}`
}

// ─────────────────────────────────────────────
// FORMATTERS DE NÚMEROS
// ─────────────────────────────────────────────

export function formatPeso(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '—'
  return `${Number(kg).toFixed(2)} kg`
}

export function formatMoneda(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return '—'
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(monto)
}

export function formatNumero(n: number | null | undefined, decimales = 0): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n)
}

// ─────────────────────────────────────────────
// GENERADORES DE CÓDIGO
// ─────────────────────────────────────────────

export function generarCodigo(prefijo: string): string {
  const fecha = format(new Date(), 'yyyyMMdd')
  const random = Math.floor(Math.random() * 9000 + 1000)
  return `${prefijo}-${fecha}-${random}`
}

export function generarCodigoAgricultor(): string {
  return generarCodigo('AGRI')
}

export function generarCodigoLiquidacionAgri(): string {
  return generarCodigo('LIQAG')
}
