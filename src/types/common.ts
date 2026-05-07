// ─────────────────────────────────────────────
// TIPOS COMUNES REUTILIZABLES
// ─────────────────────────────────────────────

export type UUID = string

export interface BaseEntity {
  id: UUID
  created_at: string
  updated_at: string
  created_by: UUID
}

export type EstadoActivo = 'activo' | 'inactivo'

export interface PaginacionParams {
  page: number
  pageSize: number
}

export interface PaginacionResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface SelectOption {
  value: string
  label: string
}

export interface ApiError {
  message: string
  code?: string
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface FormState<T> {
  data: T
  loading: boolean
  error: string | null
}
