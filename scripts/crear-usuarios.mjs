#!/usr/bin/env node
// Crea los usuarios de auth con su rol en app_metadata.
//
// El rol DEBE ir en app_metadata y no en user_metadata: resolveUserRoles()
// (src/types/auth.ts) lee app_metadata primero, y user_metadata lo puede
// editar el propio usuario desde el cliente. app_metadata solo se toca con
// la secret key, o sea desde aca.
//
// Uso (PowerShell):
//   $env:SUPABASE_SECRET_KEY = "sb_secret_..."
//   node scripts/crear-usuarios.mjs --dry-run
//   node scripts/crear-usuarios.mjs
//
// Uso (bash):
//   SUPABASE_SECRET_KEY="sb_secret_..." node scripts/crear-usuarios.mjs

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Los mismos ocho de APP_ROLES en src/types/auth.ts. Un rol mal escrito no
// falla al crear el usuario: entra y cae en el fallback de hasPermission(),
// que concede casi todos los permisos operativos. Por eso se valida aca.
const ROLES_VALIDOS = [
  'admin',
  'gerencia',
  'administrador_planta',
  'padron_agricultores',
  'tesoreria',
  'operativo_recepcion',
  'operativo_planta',
  'operativo_planta_despacho',
]

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

const env = leerEnv()
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.error('ERROR: falta VITE_SUPABASE_URL en .env (o SUPABASE_URL en el entorno).')
  process.exit(1)
}
const dryRun = process.argv.includes('--dry-run')

// El dry-run solo valida el JSON, no llama a la API: no pide la llave.
if (!secret && !dryRun) {
  console.error('ERROR: falta SUPABASE_SECRET_KEY en el entorno.')
  console.error('  Dashboard -> Settings -> API Keys -> secret key (sb_secret_...)')
  console.error('  PowerShell:  $env:SUPABASE_SECRET_KEY = "sb_secret_..."')
  process.exit(1)
}
const archivo = resolve(raiz, 'scripts/usuarios.json')

let usuarios
try {
  usuarios = JSON.parse(readFileSync(archivo, 'utf8'))
} catch (e) {
  console.error(`ERROR: no se pudo leer scripts/usuarios.json (${e.message})`)
  console.error('  Copia scripts/usuarios.example.json a scripts/usuarios.json y editalo.')
  process.exit(1)
}

if (!Array.isArray(usuarios) || usuarios.length === 0) {
  console.error('ERROR: usuarios.json debe ser un arreglo con al menos un usuario.')
  process.exit(1)
}

// Validacion completa antes de tocar la red: o entran todos o no entra ninguno.
const errores = []
const vistos = new Set()
usuarios.forEach((u, i) => {
  const donde = `usuarios[${i}]`
  if (!u.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) errores.push(`${donde}: email invalido (${u.email})`)
  else if (vistos.has(u.email.toLowerCase())) errores.push(`${donde}: email repetido (${u.email})`)
  else vistos.add(u.email.toLowerCase())
  if (!u.password || u.password.length < 8) errores.push(`${donde}: password de menos de 8 caracteres`)
  if (/CAMBIAR/i.test(u.password || '')) errores.push(`${donde}: password de ejemplo sin cambiar`)
  if (!ROLES_VALIDOS.includes(u.role)) errores.push(`${donde}: rol invalido "${u.role}" (validos: ${ROLES_VALIDOS.join(', ')})`)
})

if (errores.length) {
  console.error('Se encontraron problemas, no se creo ningun usuario:\n')
  errores.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}

console.log(`Proyecto: ${url}`)
console.log(`Usuarios a crear: ${usuarios.length}${dryRun ? '  [DRY RUN]' : ''}\n`)

if (dryRun) {
  usuarios.forEach((u) => console.log(`  ${u.email.padEnd(34)} -> ${u.role}`))
  console.log('\nValidacion OK. Corre sin --dry-run para crearlos.')
  process.exit(0)
}

let creados = 0
let existentes = 0
let fallidos = 0

for (const u of usuarios) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: u.email,
      password: u.password,
      email_confirm: true, // sin esto no pueden iniciar sesion
      app_metadata: { role: u.role },
    }),
  })

  if (res.ok) {
    const body = await res.json()
    const rol = body?.app_metadata?.role ?? '(sin rol!)'
    console.log(`  OK       ${u.email.padEnd(34)} rol=${rol}`)
    creados++
  } else {
    const texto = await res.text()
    if (res.status === 422 || /already been registered|already exists/i.test(texto)) {
      console.log(`  YA EXISTE ${u.email.padEnd(33)} (sin cambios)`)
      existentes++
    } else {
      console.error(`  FALLO    ${u.email.padEnd(34)} HTTP ${res.status}: ${texto.slice(0, 160)}`)
      fallidos++
    }
  }
}

console.log(`\ncreados: ${creados}   ya existian: ${existentes}   fallidos: ${fallidos}`)
if (existentes > 0) {
  console.log('\nNota: a los que ya existian no se les toco el rol. Si hay que corregirlo,')
  console.log('borralos desde el dashboard y vuelve a correr el script.')
}
process.exit(fallidos > 0 ? 1 : 0)
