import { zipSync, strToU8 } from 'fflate'
import { formatFecha } from '@/utils/formatters'
import type { TablaRespaldada } from '@/services/backup.service'

// Formato de respaldo pensado para volver a cargar las tablas, no para leerlas.
//
// Un CSV por tabla dentro de un ZIP. Medido sobre la base real (20.816 filas):
// CSV pesa 6,6 MB contra 12 MB de JSON, y sobre todo Postgres lo ingiere de
// forma nativa: el importador de Supabase y COPY leen CSV directamente, sin
// que nadie tenga que escribir un script.

/**
 * Escapa un valor para CSV. Se entrecomilla siempre: es mas simple de leer y
 * evita que un campo con coma, salto de linea o comilla rompa la fila. Los
 * jsonb (audit_logs) van serializados.
 */
function aCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  return `"${texto.replace(/"/g, '""')}"`
}

/** Las columnas salen de la union de todas las filas: una puede traer un campo
 *  en null y otra no. */
function columnasDe(filas: Array<Record<string, unknown>>): string[] {
  const vistas = new Set<string>()
  for (const fila of filas) {
    for (const col of Object.keys(fila)) vistas.add(col)
  }
  return [...vistas]
}

function csvDeTabla(filas: Array<Record<string, unknown>>): string {
  const columnas = columnasDe(filas)
  if (columnas.length === 0) return ''

  const lineas = [columnas.join(',')]
  for (const fila of filas) {
    lineas.push(columnas.map((col) => aCsv(fila[col])).join(','))
  }
  return lineas.join('\n')
}

function leeme(tablas: TablaRespaldada[], generado: string): string {
  const total = tablas.reduce((acc, t) => acc + t.filas.length, 0)

  return [
    'RESPALDO AGRONESIS',
    `Generado: ${generado}`,
    `${total} registros en ${tablas.length} tablas`,
    '',
    'QUE ES ESTO',
    'Un CSV por cada tabla del sistema. Sirve para volver a cargar la',
    'informacion si hiciera falta: Postgres lee CSV de forma nativa.',
    '',
    'COMO RESTAURAR',
    '1. En Supabase, entrar a Table Editor y elegir la tabla.',
    '2. Insert > Import data from CSV, y subir el archivo correspondiente.',
    '3. Respetar el orden de la lista de abajo: cada tabla apunta a las',
    '   anteriores, y si se carga al reves la base rechaza las filas.',
    '',
    'IMPORTANTE',
    'Las columnas id y created_by se conservan tal cual. Eso mantiene los',
    'vinculos entre tablas, pero exige que los usuarios de Authentication',
    'existan antes, porque created_by apunta a ellos.',
    '',
    'CONTIENE DATOS PERSONALES: DNI y numeros de cuenta del padron.',
    'Guardarlo en un lugar seguro.',
    '',
    'ORDEN DE CARGA',
    ...tablas.map((t, i) => `${String(i + 1).padStart(2, '0')}. ${t.tabla} (${t.filas.length} registros)`),
  ].join('\n')
}

/**
 * Arma un ZIP con un CSV por tabla y lo descarga. Devuelve el nombre del
 * archivo.
 */
export function generateBackupZip(tablas: TablaRespaldada[]): string {
  const ahora = new Date()
  const generado = formatFecha(ahora.toISOString(), 'dd/MM/yyyy HH:mm')

  const archivos: Record<string, Uint8Array> = {
    'LEEME.txt': strToU8(leeme(tablas, generado)),
  }

  for (const [indice, { tabla, filas }] of tablas.entries()) {
    if (filas.length === 0) continue
    // El numero delante mantiene el orden de dependencia al ver el ZIP.
    const nombre = `${String(indice + 1).padStart(2, '0')}-${tabla}.csv`
    archivos[nombre] = strToU8(csvDeTabla(filas))
  }

  const comprimido = zipSync(archivos, { level: 6 })

  const sello = formatFecha(ahora.toISOString(), 'yyyyMMdd-HHmm')
  const nombre = `respaldo-agronesis-${sello}.zip`

  // El Uint8Array puede venir sobre un ArrayBuffer mas grande, asi que se
  // recorta antes de armar el Blob.
  const bytes = comprimido.slice().buffer
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)

  return nombre
}
