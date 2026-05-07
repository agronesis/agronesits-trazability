import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createLiquidacionAgri, getLiquidacionAgri, updateLiquidacionAgri, getLoteIdsEnLiquidacionAgri, getLoteIdsEnOtrasLiquidaciones } from '@/services/liquidaciones-agri.service'
import { logAudit } from '@/services/audit.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { getConfigPrecios } from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgricultores } from '@/features/agricultores/hooks/useAgricultores'
import { useLotes } from '@/features/lotes/hooks/useLotes'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha, generarCodigoLiquidacionAgri } from '@/utils/formatters'
import { calcularTotalesClasificacion, calcularTotalLiquidacionAgri, calcularPesoAgricultor } from '@/utils/business-rules'
import { format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { CalidadProducto, CategoriaClasificacion, Clasificacion, ConfigPrecio, EstadoLote } from '@/types/models'

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const ESTADOS_LOTE_LIQUIDABLES = new Set<EstadoLote>(['clasificado', 'empaquetado', 'en_despacho', 'despachado'])

const detalleSchema = z.object({
  lote_id:             z.string().uuid(),
  categoria:           z.string(),
  peso_kg:             z.number().positive(),
  precio_kg:           z.number().positive(),
  subtotal:            z.number(),
})

const nuevaLiqSchema = z.object({
  codigo:              z.string().min(1),
  agricultor_id:       z.string().uuid('Seleccione un agricultor'),
  fecha_inicio:        z.string().min(1),
  fecha_fin:           z.string().min(1),
  detalles:            z.array(detalleSchema).min(1, 'Agregue al menos un detalle'),
  observaciones:       z.string().optional(),
}).refine((data) => data.fecha_inicio <= data.fecha_fin, {
  path: ['fecha_fin'],
  message: 'La fecha fin debe ser mayor o igual a la fecha inicio',
})

type NuevaLiqFormData = z.infer<typeof nuevaLiqSchema>
type ModoSeleccionLotes = 'agricultor' | 'fechas'

export default function NuevaLiquidacionAgriPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { id: liquidacionId } = useParams<{ id: string }>()
  const paramAgricultorId = searchParams.get('agricultor_id') ?? undefined
  const { user } = useAuthStore()
  const { agricultores } = useAgricultores()
  const { lotes } = useLotes()
  const [liquidacionEditando, setLiquidacionEditando] = useState<any>(null)
  const [cargandoEdicion, setCargandoEdicion] = useState(!!liquidacionId)
  const [clasificacionesPorLote, setClasificacionesPorLote] = useState<Record<string, Clasificacion[]>>({})
  const [cargandoClasif, setCargandoClasif] = useState(false)
  const [loteIdsYaLiquidados, setLoteIdsYaLiquidados] = useState<Set<string>>(new Set())
  const [configPrecios, setConfigPrecios] = useState<ConfigPrecio[]>([])
  const [modoSeleccionLotes, setModoSeleccionLotes] = useState<ModoSeleccionLotes>('agricultor')

  // Cargar liquidación si estamos editando
  useEffect(() => {
    if (liquidacionId) {
      getLiquidacionAgri(liquidacionId)
        .then(setLiquidacionEditando)
        .catch(() => {/* error al cargar */})
        .finally(() => setCargandoEdicion(false))
    }
  }, [liquidacionId])

  useEffect(() => {
    getConfigPrecios().then(setConfigPrecios).catch(() => {/* no bloquear si falla */})
  }, [])

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<NuevaLiqFormData>({
    resolver: zodResolver(nuevaLiqSchema),
    defaultValues: {
      codigo: generarCodigoLiquidacionAgri(),
      agricultor_id: '',
      fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
      fecha_fin: format(new Date(), 'yyyy-MM-dd'),
      detalles: [],
      observaciones: undefined,
    },
  })

  // Cargar datos en el form cuando se carga liquidacionEditando
  useEffect(() => {
    if (liquidacionEditando) {
      reset({
        codigo: liquidacionEditando.codigo,
        agricultor_id: liquidacionEditando.agricultor_id,
        fecha_inicio: liquidacionEditando.fecha_inicio,
        fecha_fin: liquidacionEditando.fecha_fin,
        detalles: (liquidacionEditando.detalles ?? []).map((d: any) => ({
          lote_id: d.lote_id,
          categoria: d.categoria,
          peso_kg: d.peso_kg,
          precio_kg: d.precio_kg,
          subtotal: d.subtotal,
        })),
        observaciones: liquidacionEditando.observaciones ?? undefined,
      })
    }
  }, [liquidacionEditando, reset])

  // Estado local para el buscador de agricultor
  const [agricultorSearch, setAgricultorSearch] = useState('')
  const [agricultorOpen, setAgricultorOpen] = useState(false)

  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })
  const agricultorId = watch('agricultor_id')
  const fechaInicio = watch('fecha_inicio')
  const fechaFin = watch('fecha_fin')

  const agricultoresActivos = agricultores.filter((a) => a.estado === 'activo')
  const agricultoresFiltrados = useMemo(() => {
    const q = normalizeSearchText(agricultorSearch)
    if (!q) return agricultoresActivos
    return agricultoresActivos.filter((a) =>
      normalizeSearchText(`${a.apellido} ${a.nombre} ${a.codigo} ${a.dni ?? ''}`).includes(q)
    )
  }, [agricultoresActivos, agricultorSearch])

  const agricultorSeleccionado = agricultoresActivos.find((a) => a.id === agricultorId) ?? null
  const loteIdsSeleccionados = useMemo(() => new Set(fields.map((field) => field.lote_id)), [fields])

  const lotesLiquidables = useMemo(() => (
    lotes.filter((l) => ESTADOS_LOTE_LIQUIDABLES.has(l.estado) && !loteIdsYaLiquidados.has(l.id))
  ), [lotes, loteIdsYaLiquidados])

  // Los lotes son liquidables desde 'clasificado' en adelante.
  // Excluimos 'liquidado' para evitar re-liquidaciones de lotes ya pagados.
  // También excluimos lotes ya presentes en cualquier liquidación previa del agricultor.
  const lotesDelAgricultor = agricultorId
    ? lotesLiquidables.filter((l) => l.agricultor_id === agricultorId)
    : []
  const lotesExcluidos = agricultorId
    ? lotes.filter((l) => l.agricultor_id === agricultorId && ESTADOS_LOTE_LIQUIDABLES.has(l.estado) && loteIdsYaLiquidados.has(l.id))
    : []

  const rangoFechasInvalido = Boolean(fechaInicio && fechaFin && fechaInicio > fechaFin)
  const lotesPorRango = useMemo(() => {
    if (!fechaInicio || !fechaFin || rangoFechasInvalido) return []

    return lotesLiquidables
      .filter((l) => estaFechaEnRango(l.fecha_ingreso, fechaInicio, fechaFin))
      .sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso) || a.codigo.localeCompare(b.codigo))
  }, [fechaFin, fechaInicio, lotesLiquidables, rangoFechasInvalido])

  const gruposLotesPorRango = useMemo(() => {
    const grupos = new Map<string, typeof lotesPorRango>()

    for (const lote of lotesPorRango) {
      const existentes = grupos.get(lote.agricultor_id) ?? []
      existentes.push(lote)
      grupos.set(lote.agricultor_id, existentes)
    }

    return Array.from(grupos.entries())
      .map(([agricultorGrupoId, lotesGrupo]) => ({
        agricultorId: agricultorGrupoId,
        agricultor: agricultoresActivos.find((item) => item.id === agricultorGrupoId) ?? null,
        lotes: lotesGrupo,
      }))
      .sort((a, b) => {
        const nombreA = a.agricultor ? `${a.agricultor.apellido} ${a.agricultor.nombre}` : a.agricultorId
        const nombreB = b.agricultor ? `${b.agricultor.apellido} ${b.agricultor.nombre}` : b.agricultorId
        return nombreA.localeCompare(nombreB)
      })
  }, [agricultoresActivos, lotesPorRango])

  const cargarClasificaciones = async () => {
    if (lotesDelAgricultor.length === 0) return
    setCargandoClasif(true)
    try {
      const results = await Promise.all(lotesDelAgricultor.map(async (l) => {
        const cls = await getClasificacionesPorLote(l.id)
        return { loteId: l.id, cls }
      }))
      const mapa: Record<string, Clasificacion[]> = {}
      results.forEach(({ loteId, cls }) => { mapa[loteId] = cls })
      setClasificacionesPorLote(mapa)
    } finally { setCargandoClasif(false) }
  }

  const obtenerClasificacionesLote = async (loteId: string) => {
    const cache = clasificacionesPorLote[loteId]
    if (cache) return cache

    const clasificaciones = await getClasificacionesPorLote(loteId)
    setClasificacionesPorLote((prev) => ({ ...prev, [loteId]: clasificaciones }))
    return clasificaciones
  }

  const prevAgricultorRef = useState<string | undefined>(undefined)
  useEffect(() => {
    if (prevAgricultorRef[0] !== undefined && prevAgricultorRef[0] !== agricultorId) {
      setValue('detalles', [])
      setClasificacionesPorLote({})
      setLoteIdsYaLiquidados(new Set())
    }
    prevAgricultorRef[0] = agricultorId
  }, [agricultorId, setValue])

  // Si estamos creando (no editando) y hay agricultor preseleccionado, cargarlo
  useEffect(() => {
    if (!liquidacionEditando && paramAgricultorId) {
      reset((formValues) => ({
        ...formValues,
        agricultor_id: paramAgricultorId,
      }))
    }
  }, [paramAgricultorId, liquidacionEditando, reset])

  useEffect(() => {
    if (agricultorId && lotes.length > 0) {
      cargarClasificaciones()
      // Si estamos editando, excluir solo otros lotes en otras liquidaciones
      // Si estamos creando, excluir lotes en cualquier liquidación
      if (liquidacionEditando) {
        getLoteIdsEnOtrasLiquidaciones(agricultorId, liquidacionEditando.id).then(setLoteIdsYaLiquidados).catch(() => {})
      } else {
        getLoteIdsEnLiquidacionAgri(agricultorId).then(setLoteIdsYaLiquidados).catch(() => {})
      }
    }
  }, [agricultorId, lotes.length, liquidacionEditando])

  const agregarDetalleLote = async (loteId: string) => {
    if (loteIdsSeleccionados.has(loteId)) return

    const lote = lotes.find((l) => l.id === loteId)
    if (!lote) return
    if (agricultorId && lote.agricultor_id !== agricultorId) return

    setCargandoClasif(true)
    try {
      if (!agricultorId) {
        setValue('agricultor_id', lote.agricultor_id, { shouldDirty: true, shouldValidate: true })
      }

      const cls = await obtenerClasificacionesLote(loteId)
      const totales = calcularTotalesClasificacion(cls)

      // Semana ISO del lote para buscar precio configurado.
      const fechaLote = lote.fecha_ingreso ? parseISO(lote.fecha_ingreso) : null
      const semanaLote = fechaLote ? getISOWeek(fechaLote) : null
      const anioLote = fechaLote ? getISOWeekYear(fechaLote) : null
      // Fallback: semana de fecha inicio de liquidación (o semana actual).
      const fechaRefLiq = fechaInicio ? parseISO(fechaInicio) : new Date()
      const semanaLiq = getISOWeek(fechaRefLiq)
      const anioLiq = getISOWeekYear(fechaRefLiq)
      const variedadLote = lote.producto?.variedad ?? null

      const categorias = Object.entries(totales) as [string, { peso_kg: number; num_cajas: number }][]
      categorias.forEach(([cat, { peso_kg }]) => {
        if (peso_kg > 0) {
          const categoriaConfig = categoriaClasificacionAConfig(cat as CategoriaClasificacion)
          const precioConf = (variedadLote && categoriaConfig)
            ? buscarPrecioConfig(configPrecios, variedadLote, categoriaConfig, semanaLote, anioLote, semanaLiq, anioLiq)
            : undefined
          // Aplicar 97%: descontar el 3% de Alan Melendrez (Módulo 1 PDF)
          const pesoAgricultor = calcularPesoAgricultor(peso_kg)
          const precioKg = precioConf?.precio_kg_sol ?? 0
          append({ lote_id: loteId, categoria: cat, peso_kg: pesoAgricultor, precio_kg: precioKg, subtotal: 0 })
        }
      })
    } finally {
      setCargandoClasif(false)
    }
  }

  const cambiarModoSeleccionLotes = (value: string) => {
    const siguienteModo = value as ModoSeleccionLotes
    if (modoSeleccionLotes === 'agricultor' && siguienteModo === 'fechas' && agricultorId) {
      setValue('agricultor_id', '', { shouldDirty: true, shouldValidate: true })
    }
    setModoSeleccionLotes(siguienteModo)
  }

  const onSubmit = async (data: NuevaLiqFormData) => {
    if (!user) return
    // Recalcular subtotales
    const detalles = data.detalles.map((d) => ({ ...d, subtotal: (Number(d.peso_kg) || 0) * (Number(d.precio_kg) || 0) }))
    const { total_kg, total_monto } = calcularTotalLiquidacionAgri(detalles)
    
    if (liquidacionEditando) {
      // Editar
      const updated = await updateLiquidacionAgri(
        liquidacionEditando.id,
        { codigo: data.codigo, agricultor_id: data.agricultor_id, fecha_inicio: data.fecha_inicio, fecha_fin: data.fecha_fin, total_kg, total_monto, observaciones: data.observaciones ?? null },
        detalles as any,
        user.id
      )
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: updated.id,
        descripcion: `Liquidación editada: ${updated.codigo}`,
        datosAnteriores: { codigo: liquidacionEditando.codigo, total_monto: liquidacionEditando.total_monto },
        datosNuevos: { codigo: updated.codigo, total_monto: updated.total_monto },
      })
      navigate(`/liquidaciones/agricultores/${updated.id}`)
    } else {
      // Crear
      const liq = await createLiquidacionAgri(
        { codigo: data.codigo, agricultor_id: data.agricultor_id, fecha_inicio: data.fecha_inicio, fecha_fin: data.fecha_fin, total_kg, total_monto, estado: 'borrador', observaciones: data.observaciones ?? null },
        detalles as any,
        user.id
      )
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'crear',
        modulo: 'liquidaciones_agri',
        registroId: liq.id,
        descripcion: `Liquidación creada: ${liq.codigo}`,
        datosAnteriores: null,
        datosNuevos: { codigo: liq.codigo, total_monto: liq.total_monto },
      })
      navigate(`/liquidaciones/agricultores/${liq.id}`)
    }
  }

  const totalEstimado = fields.reduce((acc, _field, i) => {
    const precio = Number(watch(`detalles.${i}.precio_kg`)) || 0
    const peso = Number(watch(`detalles.${i}.peso_kg`)) || 0
    return acc + (precio * peso)
  }, 0)

  const pageTitle = liquidacionEditando ? `Editar liquidación - ${liquidacionEditando.codigo}` : 'Nueva liquidación – Agricultor'
  const submitLabel = liquidacionEditando ? 'Guardar cambios' : 'Crear liquidación'

  if (cargandoEdicion) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="Cargando..." backHref="/liquidaciones/agricultores" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={pageTitle} backHref="/liquidaciones/agricultores" />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Tabs value={modoSeleccionLotes} onValueChange={cambiarModoSeleccionLotes}>
          <TabsList>
            <TabsTrigger value="agricultor">Por agricultor</TabsTrigger>
            <TabsTrigger value="fechas">Por fechas</TabsTrigger>
          </TabsList>

          <Card>
            <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Código" required>
                <Input {...register('codigo')} readOnly className="bg-muted text-muted-foreground cursor-default" />
              </FormField>
              {modoSeleccionLotes === 'agricultor' ? (
                <FormField label="Agricultor" error={errors.agricultor_id?.message} required>
                  <Controller name="agricultor_id" control={control} render={({ field }) => (
                    <Popover open={agricultorOpen} onOpenChange={(o) => { setAgricultorOpen(o); if (!o) setAgricultorSearch('') }}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                            !agricultorSeleccionado && 'text-muted-foreground'
                          )}
                        >
                          <span className="line-clamp-1 text-left">
                            {agricultorSeleccionado
                              ? `${agricultorSeleccionado.apellido}, ${agricultorSeleccionado.nombre} (${agricultorSeleccionado.codigo})`
                              : 'Buscar agricultor...'}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-80" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              className="pl-7 h-8 text-sm"
                              placeholder="Nombre, código o DNI..."
                              value={agricultorSearch}
                              onChange={(e) => setAgricultorSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {agricultoresFiltrados.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                          ) : agricultoresFiltrados.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm hover:bg-accent',
                                field.value === a.id && 'bg-accent font-medium'
                              )}
                              onClick={() => { field.onChange(a.id); setAgricultorOpen(false); setAgricultorSearch('') }}
                            >
                              <span className="block">{a.apellido}, {a.nombre}</span>
                              <span className="text-xs text-muted-foreground">{a.codigo}{a.dni ? ` · ${a.dni}` : ''}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )} />
                </FormField>
              ) : (
                <FormField label="Agricultor de la liquidación" error={errors.agricultor_id?.message} required>
                  <div className="flex min-h-10 items-center rounded-md border border-dashed border-input bg-muted/40 px-3 py-2 text-sm">
                    {agricultorSeleccionado
                      ? `${agricultorSeleccionado.apellido}, ${agricultorSeleccionado.nombre} (${agricultorSeleccionado.codigo})`
                      : 'Se asignará automáticamente al elegir el primer lote del rango.'}
                  </div>
                </FormField>
              )}
              <FormField label="Fecha inicio" error={errors.fecha_inicio?.message} required>
                <Input type="date" {...register('fecha_inicio')} />
              </FormField>
              <FormField label="Fecha fin" error={errors.fecha_fin?.message} required>
                <Input type="date" {...register('fecha_fin')} />
              </FormField>
              <FormField label="Observaciones" className="sm:col-span-2">
                <Textarea rows={2} {...register('observaciones')} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selección de lotes</CardTitle>
              <p className="text-sm text-muted-foreground">Puedes seguir trabajando por agricultor o abrir un rango de fechas y escoger lotes desde ahí.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TabsContent value="agricultor" className="pt-0">
                {!agricultorId ? (
                  <p className="text-sm text-muted-foreground">Selecciona un agricultor para ver sus lotes liquidables.</p>
                ) : cargandoClasif ? (
                  <p className="text-sm text-muted-foreground">Cargando clasificaciones...</p>
                ) : (
                  <>
                    {lotesDelAgricultor.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {lotesDelAgricultor.map((l) => (
                          <Button
                            key={l.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loteIdsSeleccionados.has(l.id)}
                            onClick={() => { void agregarDetalleLote(l.id) }}
                          >
                            {l.codigo}{loteIdsSeleccionados.has(l.id) ? ' agregado' : ''}
                          </Button>
                        ))}
                      </div>
                    )}
                    {lotesExcluidos.length > 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {lotesExcluidos.length} lote{lotesExcluidos.length > 1 ? 's' : ''} excluido{lotesExcluidos.length > 1 ? 's' : ''} ({lotesExcluidos.map((l) => l.codigo).join(', ')}) — ya están en una liquidación previa
                      </p>
                    )}
                    {lotesDelAgricultor.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hay lotes disponibles sin liquidar para este agricultor.</p>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="fechas" className="pt-0">
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    El primer lote elegido define el agricultor de la liquidación. Los demás lotes quedarán restringidos a ese mismo agricultor.
                  </p>

                  {rangoFechasInvalido ? (
                    <p className="text-sm text-destructive">Corrige el rango de fechas para mostrar los lotes disponibles.</p>
                  ) : gruposLotesPorRango.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay lotes liquidables dentro del rango seleccionado.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {gruposLotesPorRango.map((grupo) => {
                        const bloqueadoPorAgricultor = Boolean(agricultorId && grupo.agricultorId !== agricultorId)
                        return (
                          <div key={grupo.agricultorId} className="rounded-lg border p-3">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">
                                  {grupo.agricultor
                                    ? `${grupo.agricultor.apellido}, ${grupo.agricultor.nombre}`
                                    : grupo.agricultorId}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {grupo.agricultor?.codigo ?? 'Sin código'} · {grupo.lotes.length} lote{grupo.lotes.length > 1 ? 's' : ''} en el rango
                                </p>
                              </div>
                              {bloqueadoPorAgricultor && agricultorSeleccionado && (
                                <p className="text-xs text-amber-700">
                                  Bloqueado: la liquidación ya quedó asociada a {agricultorSeleccionado.apellido}, {agricultorSeleccionado.nombre}.
                                </p>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {grupo.lotes.map((lote) => {
                                const yaAgregado = loteIdsSeleccionados.has(lote.id)
                                return (
                                  <Button
                                    key={lote.id}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={yaAgregado || bloqueadoPorAgricultor}
                                    onClick={() => { void agregarDetalleLote(lote.id) }}
                                  >
                                    {lote.codigo} · {formatFecha(lote.fecha_ingreso, 'dd/MM')}{yaAgregado ? ' agregado' : ''}
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {lotesExcluidos.length > 0 && agricultorSeleccionado && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {lotesExcluidos.length} lote{lotesExcluidos.length > 1 ? 's' : ''} de {agricultorSeleccionado.apellido}, {agricultorSeleccionado.nombre} no aparecen porque ya fueron incluidos en otra liquidación.
                    </p>
                  )}
                </div>
              </TabsContent>
            </CardContent>
          </Card>

          {/* Detalles */}
          {fields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalles</CardTitle>
                <p className="text-xs text-muted-foreground">El peso ya incluye el descuento del porcentaje de deshidratación.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {fields.map((field, index) => {
                  const lote = lotes.find((l) => l.id === field.lote_id)
                  return (
                    <div key={field.id} className="grid grid-cols-3 gap-2 items-end border-b pb-3 last:border-0">
                      <div className="col-span-3 text-xs text-muted-foreground font-medium">
                        Lote: {lote?.codigo ?? field.lote_id} · Categoría: <span className="capitalize">{field.categoria}</span>
                      </div>
                      <FormField label="Peso (kg)">
                        <Input
                          type="number"
                          step="0.01"
                          readOnly
                          className="bg-muted text-muted-foreground cursor-default"
                          {...register(`detalles.${index}.peso_kg`, { valueAsNumber: true })}
                        />
                      </FormField>
                      <FormField label="Precio (S/./kg)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          onFocus={(e) => {
                            if (e.currentTarget.value === '0') {
                              e.currentTarget.value = ''
                            }
                          }}
                          {...register(`detalles.${index}.precio_kg`, {
                            valueAsNumber: true,
                            setValueAs: (v) => (v === '' || isNaN(Number(v)) ? 0 : Number(v)),
                          })}
                        />
                      </FormField>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => remove(index)}>
                        Quitar
                      </Button>
                    </div>
                  )
                })}
                <p className="text-sm text-right font-medium">Total estimado: <strong>S/. {totalEstimado.toFixed(2)}</strong></p>
                {errors.detalles && <p className="text-sm text-destructive">{(errors.detalles as any).message}</p>}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
          </div>
        </Tabs>
      </form>
    </div>
  )
}

function categoriaClasificacionAConfig(categoria: CategoriaClasificacion): CalidadProducto | null {
  if (categoria === 'primera') return 'cat1'
  if (categoria === 'segunda') return 'cat2'
  return null
}

function estaFechaEnRango(fechaIso: string, fechaInicio: string, fechaFin: string): boolean {
  const fecha = fechaIso.slice(0, 10)
  return fecha >= fechaInicio && fecha <= fechaFin
}

function buscarPrecioConfig(
  configs: ConfigPrecio[],
  variedad: ConfigPrecio['variedad'],
  categoria: CalidadProducto,
  semanaLote: number | null,
  anioLote: number | null,
  semanaLiq: number,
  anioLiq: number,
): ConfigPrecio | undefined {
  const candidatos = [
    semanaLote && anioLote ? { semana: semanaLote, anio: anioLote } : null,
    { semana: semanaLiq, anio: anioLiq },
  ].filter((c): c is { semana: number; anio: number } => Boolean(c))

  for (const c of candidatos) {
    const encontrado = configs.find(
      (cfg) => cfg.semana === c.semana && cfg.anio === c.anio && cfg.variedad === variedad && cfg.categoria === categoria
    )
    if (encontrado) return encontrado
  }

  return undefined
}
