#!/usr/bin/env node
// Importa los lotes ya seleccionados desde el export "lotes-seleccionados-*.xlsx"
// de la app (boton Descargar en Lotes), recreando por cada fila:
//
//   - un lote en estado "clasificado"
//   - su sesion de clasificacion con el peso exportable
//
// Lo que ese export NO trae, y por lo tanto no se puede restaurar:
//
//   - El centro de acopio. La columna "Lugar de produccion" es la ubicacion del
//     agricultor, no el centro. Todos los lotes van al centro CENTRO_ACOPIO.
//   - El recepcionista. Queda vacio (la columna admite null).
//   - La calidad y el tipo de produccion del producto: solo viene la variedad,
//     asi que se usa el producto cat1 convencional de esa variedad.
//   - El detalle por seleccionador. Solo se guarda el peso exportable en la
//     clasificacion; jabas seleccionadas y descarte se pierden. No se inventan
//     aportes para no ensuciar las planillas de pago.
//   - El codigo original del lote: lo regenera un trigger al insertar, con la
//     fecha de hoy (LOT-AAAAMMDD-NNN). El codigo que daba el agricultor si se
//     conserva, en codigo_lote_agricultor.
//
// Para poder reanudarlo si se corta, cada lote lleva una marca en observaciones
// con el archivo y la fila de origen; al volver a correr se saltan los ya hechos.
//
// Uso (PowerShell):
//   $env:IMPORT_EMAIL = "gerencia@agronesis.com"
//   $env:IMPORT_PASSWORD = "..."
//   node scripts/importar-lotes-seleccionados.mjs lotes-seleccionados-20260919-1503.xlsx --dry-run
//   node scripts/importar-lotes-seleccionados.mjs lotes-seleccionados-20260919-1503.xlsx

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx-js-style')

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── Configuracion ────────────────────────────────────────────────────────────

// Centro al que se asignan todos los lotes. Si no existe se crea.
const CENTRO_ACOPIO = 'PLANTA PRINCIPAL - FUNDO EL MILAGRO'

// Variedad del Excel -> producto a usar. El export no dice calidad ni tipo de
// produccion, asi que se toma el cat1 convencional de cada variedad.
const PRODUCTO_POR_VARIEDAD = {
  'SNOW PEAS': { variedad: 'snow_peas', calidad: 'cat1', tipo_produccion: 'convencional' },
  'SUGAR SNAP': { variedad: 'sugar', calidad: 'cat1', tipo_produccion: 'convencional' },
}

const ESTADO_LOTE = 'clasificado'
const TAMANO_LOTE = 500

// ── Utilidades ───────────────────────────────────────────────────────────────

function leerEnv() {
  const env = {}
  try {
    for (const linea of readFileSync(resolve(raiz, '.env'), 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].trim()
    }
  } catch {
    /* sin .env: se cae al chequeo de abajo */
  }
  return env
}

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim())
const clave = (v) =>
  texto(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ')
// El export escribe "-" cuando el dato esta vacio.
const opcional = (v) => {
  const t = texto(v)
  return t && t !== '-' ? t : null
}
const numero = (v) => {
  const n = typeof v === 'number' ? v : Number(texto(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

function fechaISO(v) {
  if (typeof v === 'number') {
    const f = XLSX.SSF.parse_date_code(v)
    return f ? `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}` : null
  }
  const m = texto(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

const env = leerEnv()
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const apiKey = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const archivo = args.find((a) => !a.startsWith('--'))

if (!url || !apiKey) {
  console.error('ERROR: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}
if (!archivo) {
  console.error('Uso: node scripts/importar-lotes-seleccionados.mjs <archivo.xlsx> [--dry-run]')
  process.exit(1)
}

const marcaArchivo = basename(archivo).replace(/\.xlsx$/i, '')
const marca = (fila) => `[imp:${marcaArchivo}#${fila}]`

// ── Lectura del Excel ────────────────────────────────────────────────────────

const COL = {
  codigoLoteAgricultor: 0,
  sublote: 1,
  agricultor: 2,
  dni: 3,
  ubicacion: 4,
  cuenta: 5,
  fechaRecepcion: 6,
  variedad: 7,
  jabas: 8,
  brutoRecepcion: 9,
  netoRecepcion: 10,
  fechaSeleccion: 11,
  exportable: 14,
}

let matriz
try {
  const wb = XLSX.readFile(resolve(process.cwd(), archivo))
  matriz = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null })
} catch (e) {
  console.error(`ERROR: no se pudo abrir ${archivo} (${e.message})`)
  process.exit(1)
}

const filaEncabezado = matriz.findIndex((f) => (f ?? []).some((c) => clave(c) === 'CODIGO AGRICULTOR'))
if (filaEncabezado === -1) {
  console.error('ERROR: no se encontro la fila de encabezados (columna "Codigo agricultor").')
  process.exit(1)
}

const errores = []
const avisos = []
const registros = []

matriz.slice(filaEncabezado + 1).forEach((fila, i) => {
  if (!fila || fila.every((c) => texto(c) === '')) return
  // El archivo puede traer el encabezado repetido a mitad de la tabla.
  if (clave(fila[COL.variedad]) === 'VARIEDAD') return

  const nroFila = filaEncabezado + i + 2
  const codigoAgri = texto(fila[COL.codigoLoteAgricultor])
  const variedad = clave(fila[COL.variedad])
  const fechaIngreso = fechaISO(fila[COL.fechaRecepcion])
  const fechaClasificacion = fechaISO(fila[COL.fechaSeleccion])
  const jabas = numero(fila[COL.jabas])
  const bruto = numero(fila[COL.brutoRecepcion])
  const neto = numero(fila[COL.netoRecepcion])
  const exportable = numero(fila[COL.exportable])

  if (!codigoAgri) errores.push(`fila ${nroFila}: sin codigo de agricultor`)
  if (!PRODUCTO_POR_VARIEDAD[variedad]) errores.push(`fila ${nroFila}: variedad desconocida "${texto(fila[COL.variedad])}"`)
  if (!fechaIngreso) errores.push(`fila ${nroFila}: fecha de recepcion invalida`)
  if (!fechaClasificacion) errores.push(`fila ${nroFila}: fecha de seleccion invalida`)
  if (jabas === null || jabas < 0) errores.push(`fila ${nroFila}: jabas ingresadas invalidas`)
  if (bruto === null || bruto < 0) errores.push(`fila ${nroFila}: peso bruto invalido`)
  if (neto === null || neto < 0) errores.push(`fila ${nroFila}: peso neto invalido`)
  if (exportable === null || exportable < 0) errores.push(`fila ${nroFila}: peso exportable invalido`)
  if (errores.length) return

  // La tara por jaba no se exporta, pero se deduce: el neto de recepcion es
  // bruto - tara * jabas.
  const tara = jabas > 0 ? redondear((bruto - neto) / jabas) : 0
  if (tara < 0) avisos.push(`fila ${nroFila}: peso neto mayor que el bruto, tara forzada a 0`)
  if (exportable > neto) avisos.push(`fila ${nroFila}: el peso exportable (${exportable}) supera al neto de recepcion (${neto})`)

  registros.push({
    fila: nroFila,
    codigoAgri,
    nombre: texto(fila[COL.agricultor]),
    dni: opcional(fila[COL.dni]),
    ubicacion: opcional(fila[COL.ubicacion]),
    cuenta: opcional(fila[COL.cuenta]),
    variedad,
    lote: {
      codigo_lote_agricultor: codigoAgri,
      sublote: opcional(fila[COL.sublote]),
      fecha_ingreso: fechaIngreso,
      // No se exporta; se usa la de recepcion, que es lo mas cercano.
      fecha_cosecha: fechaIngreso,
      num_cubetas: Math.round(jabas),
      peso_bruto_kg: redondear(bruto),
      peso_neto_kg: redondear(neto),
      peso_tara_kg: Math.max(tara, 0),
      jabas_prestadas: 0,
      estado: ESTADO_LOTE,
      observaciones: marca(nroFila),
    },
    clasificacion: {
      fecha_clasificacion: fechaClasificacion,
      peso_bueno_kg: redondear(exportable),
    },
  })
})

if (errores.length) {
  console.error(`Se encontraron ${errores.length} problemas, no se importo nada:\n`)
  errores.slice(0, 30).forEach((e) => console.error(`  - ${e}`))
  if (errores.length > 30) console.error(`  ... y ${errores.length - 30} mas`)
  process.exit(1)
}

console.log(`Proyecto: ${url}`)
console.log(`Archivo:  ${archivo}`)
console.log(`Filas leidas: ${registros.length}`)
const porVariedad = registros.reduce((a, r) => ({ ...a, [r.variedad]: (a[r.variedad] ?? 0) + 1 }), {})
console.log(`  por variedad: ${Object.entries(porVariedad).map(([v, n]) => `${v} ${n}`).join(', ')}`)
console.log(`  rango de fechas: ${registros.reduce((m, r) => (r.lote.fecha_ingreso < m ? r.lote.fecha_ingreso : m), '9999')} a ${registros.reduce((m, r) => (r.lote.fecha_ingreso > m ? r.lote.fecha_ingreso : m), '0')}`)

// ── Conexion ─────────────────────────────────────────────────────────────────

const email = process.env.IMPORT_EMAIL
const password = process.env.IMPORT_PASSWORD
if (!email || !password) {
  console.error('\nERROR: faltan IMPORT_EMAIL e IMPORT_PASSWORD en el entorno.')
  process.exit(1)
}

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const sesion = await login.json()
if (!login.ok || !sesion.access_token) {
  console.error(`\nERROR: no se pudo iniciar sesion como ${email}: ${sesion.error_description || sesion.msg || login.status}`)
  process.exit(1)
}
const usuario = sesion.user.id
const headers = { apikey: apiKey, Authorization: `Bearer ${sesion.access_token}`, 'Content-Type': 'application/json' }

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${url}/rest/v1/${ruta}`, { ...opciones, headers: { ...headers, ...opciones.headers } })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}: ${(await res.text()).slice(0, 300)}`)
  // Con Prefer: return=minimal el cuerpo viene vacio y res.json() reventaria.
  const cuerpo = await res.text()
  return cuerpo ? JSON.parse(cuerpo) : null
}

// ── Resolver referencias ─────────────────────────────────────────────────────

const productos = await pedir('productos?select=id,codigo,variedad,calidad,tipo_produccion')
const productoPorVariedad = {}
for (const [etiqueta, spec] of Object.entries(PRODUCTO_POR_VARIEDAD)) {
  const p = productos.find(
    (x) => x.variedad === spec.variedad && x.calidad === spec.calidad && x.tipo_produccion === spec.tipo_produccion,
  )
  if (!p) {
    console.error(`\nERROR: no existe el producto ${spec.variedad} / ${spec.calidad} / ${spec.tipo_produccion} (para "${etiqueta}").`)
    console.error('Crealo desde la app en Productos y vuelve a correr el script.')
    process.exit(1)
  }
  productoPorVariedad[etiqueta] = p
  console.log(`  producto ${etiqueta} -> ${p.codigo}`)
}

let centro = (await pedir(`centros_acopio?select=id,codigo,nombre&nombre=eq.${encodeURIComponent(CENTRO_ACOPIO)}`))[0]
if (!centro) {
  if (dryRun) {
    console.log(`  centro de acopio "${CENTRO_ACOPIO}" -> se creara`)
    centro = { id: '(por crear)', codigo: '(por crear)' }
  } else {
    centro = (
      await pedir('centros_acopio?select=id,codigo,nombre', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ nombre: CENTRO_ACOPIO, estado: 'activo', created_by: usuario }),
      })
    )[0]
    console.log(`  centro de acopio creado: ${centro.codigo} ${CENTRO_ACOPIO}`)
  }
} else {
  console.log(`  centro de acopio -> ${centro.codigo} ${centro.nombre}`)
}

const agricultores = await pedir('agricultores?select=id,codigo', { headers: { Range: '0-99999' } })
const agricultorPorCodigo = new Map(agricultores.map((a) => [clave(a.codigo), a.id]))

// Agricultores que aparecen en los lotes pero no en el padron: son altas
// posteriores al export del padron. Se crean con lo que trae este Excel.
const faltantes = new Map()
for (const r of registros) {
  const k = clave(r.codigoAgri)
  if (!agricultorPorCodigo.has(k) && !faltantes.has(k)) faltantes.set(k, r)
}

if (faltantes.size) {
  console.log(`\nAgricultores que no estan en el padron: ${faltantes.size}`)
  for (const r of faltantes.values()) console.log(`  ${r.codigoAgri.padEnd(6)} ${r.nombre}  DNI ${r.dni ?? '-'}`)
  if (!dryRun) {
    // El export los trae como "APELLIDOS, NOMBRES".
    const nuevos = [...faltantes.values()].map((r) => {
      const [apellido, nombre] = r.nombre.includes(',') ? r.nombre.split(',') : ['', r.nombre]
      return {
        codigo: r.codigoAgri,
        apellido: texto(apellido),
        nombre: texto(nombre) || texto(r.nombre),
        dni: r.dni,
        numero_cuenta: r.cuenta,
        ubicacion: r.ubicacion,
        fecha_alta: r.lote.fecha_ingreso,
        estado: 'activo',
        created_by: usuario,
      }
    })
    const creados = await pedir('agricultores?select=id,codigo', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(nuevos),
    })
    creados.forEach((a) => agricultorPorCodigo.set(clave(a.codigo), a.id))
    console.log(`  creados: ${creados.length}`)
  }
}

// ── Reanudacion ──────────────────────────────────────────────────────────────

async function paginar(ruta) {
  const todo = []
  for (let desde = 0; ; desde += 1000) {
    const pagina = await pedir(ruta, { headers: { Range: `${desde}-${desde + 999}` } })
    todo.push(...pagina)
    if (pagina.length < 1000) return todo
  }
}

const filtroMarca = `observaciones=like.*${encodeURIComponent(`[imp:${marcaArchivo}#`)}*`
const lotesExistentes = await paginar(`lotes?select=id,observaciones&${filtroMarca}&order=id`)
const idPorMarca = new Map(lotesExistentes.map((l) => [l.observaciones, l.id]))

// Un corte entre insertar el lote y su clasificacion dejaba lotes sin ella, asi
// que se comprueban por separado en vez de darlos por hecho juntos.
const conClasificacion = new Set(
  lotesExistentes.length ? (await paginar('clasificaciones?select=lote_id&order=id')).map((c) => c.lote_id) : [],
)

const pendientes = registros.filter((r) => !idPorMarca.has(r.lote.observaciones))
const clasifFaltantes = registros
  .filter((r) => idPorMarca.has(r.lote.observaciones) && !conClasificacion.has(idPorMarca.get(r.lote.observaciones)))
  .map((r) => ({ ...r.clasificacion, lote_id: idPorMarca.get(r.lote.observaciones), created_by: usuario }))
console.log(`\nLotes ya importados: ${registros.length - pendientes.length}   pendientes: ${pendientes.length}`)
if (clasifFaltantes.length) console.log(`Clasificaciones por completar de lotes ya creados: ${clasifFaltantes.length}`)

if (avisos.length) {
  console.log(`\nAvisos (${avisos.length}):`)
  avisos.slice(0, 10).forEach((a) => console.log(`  - ${a}`))
  if (avisos.length > 10) console.log(`  ... y ${avisos.length - 10} mas`)
}

if (dryRun) {
  console.log('\n[DRY RUN] No se inserto nada. Corre sin --dry-run para importar.')
  process.exit(0)
}
let clasifOk = 0
for (let i = 0; i < clasifFaltantes.length; i += TAMANO_LOTE) {
  const grupo = clasifFaltantes.slice(i, i + TAMANO_LOTE)
  await pedir('clasificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(grupo) })
  clasifOk += grupo.length
  console.log(`  clasificaciones completadas: ${clasifOk} / ${clasifFaltantes.length}`)
}

if (!pendientes.length) {
  console.log(`\nListo: ${clasifOk} clasificaciones completadas. No habia lotes pendientes.`)
  process.exit(0)
}

// ── Insercion ────────────────────────────────────────────────────────────────

let lotesOk = 0
for (let i = 0; i < pendientes.length; i += TAMANO_LOTE) {
  const grupo = pendientes.slice(i, i + TAMANO_LOTE)
  try {
    const insertados = await pedir('lotes?select=id,observaciones', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(
        grupo.map((r) => ({
          ...r.lote,
          agricultor_id: agricultorPorCodigo.get(clave(r.codigoAgri)),
          producto_id: productoPorVariedad[r.variedad].id,
          centro_acopio_id: centro.id,
          created_by: usuario,
        })),
      ),
    })
    lotesOk += insertados.length

    // La clasificacion necesita el id del lote, por eso va en un segundo paso.
    const idPorMarca = new Map(insertados.map((l) => [l.observaciones, l.id]))
    const clasificaciones = grupo
      .filter((r) => idPorMarca.has(r.lote.observaciones))
      .map((r) => ({ ...r.clasificacion, lote_id: idPorMarca.get(r.lote.observaciones), created_by: usuario }))
    await pedir('clasificaciones', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(clasificaciones),
    })
    clasifOk += clasificaciones.length

    console.log(`  ${lotesOk} / ${pendientes.length} lotes`)
  } catch (e) {
    console.error(`\nERROR en el grupo que empieza en la fila ${grupo[0].fila}: ${e.message}`)
    console.error(`Insertados antes del error: ${lotesOk} lotes, ${clasifOk} clasificaciones.`)
    console.error('Volve a correr el script: retoma desde donde quedo.')
    process.exit(1)
  }
}

console.log(`\nListo: ${lotesOk} lotes y ${clasifOk} clasificaciones importados como ${email}.`)
