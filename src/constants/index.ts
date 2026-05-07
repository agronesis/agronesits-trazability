// ─────────────────────────────────────────────
// CONSTANTES DEL SISTEMA
// ─────────────────────────────────────────────

export const APP_NAME = 'AGRONESIS – Trazabilidad'
export const APP_VERSION = '1.0.0'

// Estados y sus etiquetas/colores para UI
export const ESTADO_LOTE_CONFIG = {
  ingresado:        { label: 'Ingresado',            color: 'bg-blue-100 text-blue-800' },
  en_clasificacion: { label: 'Clasificando',          color: 'bg-yellow-100 text-yellow-800' },
  clasificado:      { label: 'Clasificado',           color: 'bg-purple-100 text-purple-800' },
  empaquetado:      { label: 'Empaquetado',           color: 'bg-indigo-100 text-indigo-800' },
  en_despacho:      { label: 'Por Despachar',         color: 'bg-orange-100 text-orange-800' },
  despachado:       { label: 'Despachado',             color: 'bg-green-100 text-green-800' },
  liquidado:        { label: 'Liquidado',             color: 'bg-gray-100 text-gray-700' },
} as const

export const ESTADO_LIQUIDACION_CONFIG = {
  borrador:   { label: 'Borrador',   color: 'bg-gray-100 text-gray-700' },
  confirmada: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  pagada:     { label: 'Liquidado',  color: 'bg-green-100 text-green-800' },
} as const

export const VARIEDAD_PRODUCTO_CONFIG = {
  snow_peas:   { label: 'Snow Peas' },
  sugar:       { label: 'Sugar Snap' },
} as const

export const CALIDAD_PRODUCTO_CONFIG = {
  cat1: { label: 'CAT 1' },
  cat2: { label: 'CAT 2' },
} as const

export const TIPO_PRODUCCION_CONFIG = {
  organico: { label: 'Organico' },
  convencional: { label: 'Convencional' },
} as const

export const CATEGORIA_CLASIFICACION_CONFIG = {
  primera:  { label: 'Primera',  color: 'bg-green-100 text-green-800' },
  segunda:  { label: 'Segunda',  color: 'bg-yellow-100 text-yellow-800' },
  descarte: { label: 'Descarte', color: 'bg-red-100 text-red-800' },
} as const

export const DESTINO_DESPACHO_CONFIG = {
  exportacion:    { label: 'Exportación'     },
  mercado_local:  { label: 'Mercado Local'   },
  planta_proceso: { label: 'Planta de Proceso' },
} as const

export const TIPO_DESPACHO_CONFIG = {
  maritima:  { label: 'Marítima'  },
  aerea:     { label: 'Aérea'     },
  terrestre: { label: 'Terrestre' },
} as const

export const TIPO_MOVIMIENTO_CUBETA_CONFIG = {
  entrega:     { label: 'Entrega',     color: 'bg-blue-100 text-blue-800' },
  devolucion:  { label: 'Devolución',  color: 'bg-green-100 text-green-800' },
} as const

export const ROL_COLABORADOR_CONFIG = {
  recepcionista: { label: 'Recepcionista' },
  seleccionador: { label: 'Seleccionador' },
  empaquetador: { label: 'Empaquetador' },
} as const

// Transiciones válidas de estado de lote
export const TRANSICIONES_LOTE: Record<string, string[]> = {
  ingresado:        ['en_clasificacion'],
  en_clasificacion: ['clasificado'],
  clasificado:      ['empaquetado'],
  empaquetado:      ['en_despacho'],
  en_despacho:      ['despachado'],
  despachado:       ['liquidado'],
  liquidado:        [],
}

// Rutas del sistema
export const ROUTES = {
  LOGIN:                    '/login',
  DASHBOARD:                '/',
  AGRICULTORES:             '/agricultores',
  AGRICULTORES_NUEVO:       '/agricultores/nuevo',
  AGRICULTORES_EDITAR:      '/agricultores/:id/editar',
  ACOPIADORES:              '/acopiadores',
  COLABORADORES:            '/colaboradores',
  PRODUCTOS:                '/productos',
  PRODUCTOS_NUEVO:          '/productos/nuevo',
  PRODUCTOS_EDITAR:         '/productos/:id/editar',
  CENTROS_ACOPIO:           '/centros-acopio',
  CENTROS_ACOPIO_NUEVO:     '/centros-acopio/nuevo',
  CENTROS_ACOPIO_EDITAR:    '/centros-acopio/:id/editar',
  LOTES:                     '/lotes',
  LOTES_NUEVO:              '/lotes/nuevo',
  LOTES_DETALLE:            '/lotes/:id',
  CLASIFICACIONES:          '/lotes/:id/clasificar',
  EMPAQUETAR:              '/lotes/:id/empaquetar',
  LIQUIDACIONES_AGRI:       '/liquidaciones/agricultores',
  LIQUIDACIONES_AGRI_NUEVA: '/liquidaciones/agricultores/nueva',
  LIQUIDACIONES_AGRI_DETALLE: '/liquidaciones/agricultores/:id',
  LIQUIDACIONES_AGRI_EDITAR: '/liquidaciones/agricultores/:id/editar',
  PLANILLAS:                '/planillas',
  TAREO:                    '/tareo',
  CUBETAS:                  '/cubetas',
  DESPACHOS:                '/despachos',
  DESPACHOS_NUEVO:          '/despachos/nuevo',
  DESPACHOS_DETALLE:        '/despachos/:id',
  DESPACHOS_EDITAR:         '/despachos/:id/editar',
  CONFIG_PRECIOS:           '/admin/config-precios',
  CONFIG_PARAMETROS:        '/admin/config-parametros',
  AUDIT_LOG:                '/gerencia/audit-log',
} as const

// Controla módulos habilitados en UI/ruteo.
// Si un módulo está en false, se oculta del menú y redirige al home al abrir su URL.
export const ENABLED_MODULES = {
  CUBETAS: false,
} as const
