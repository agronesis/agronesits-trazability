import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { getLote } from '@/services/lotes.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { getEmpaquetadosPorLote } from '@/services/empaquetados.service'
import { getDespachosPorLote } from '@/services/despachos.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoteTimeline } from './LoteTimeline'
import { printLoteTicket } from './printLoteTicket'
import { printEmpaquetadoLabel } from './printDespachoLabel'
import {
  ROUTES,
  DESTINO_DESPACHO_CONFIG,
  TIPO_DESPACHO_CONFIG,
  VARIEDAD_PRODUCTO_CONFIG,
  CALIDAD_PRODUCTO_CONFIG,
  TIPO_PRODUCCION_CONFIG,
} from '@/constants'
import { formatFecha, formatPeso, formatMoneda } from '@/utils/formatters'
import { calcularPagoSeleccionador, calcularPesoPorJaba, normalizarNumeroPallet } from '@/utils/business-rules'
import type { Lote, Clasificacion, Despacho, Empaquetado } from '@/types/models'
import { useAuthStore } from '@/store/auth.store'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roundTo2 = (value: number) => Math.round(value * 100) / 100

const calcularNetoPorTara = (kgBruto: number, cantidadJabas: number, pesoTara: number) => {
  return roundTo2(Math.max(0, kgBruto - (cantidadJabas * pesoTara)))
}

type CuadroLocal = {
  filas: Array<{
    colaborador_id: string
    kg_cat1?: string
    kg_cat2?: string
    peso_bueno_kg?: string
    kg_bruto?: string
    num_jabas?: string
    peso_tara_kg?: string
    kg_exportable?: string
    jabas_descartadas?: string
    kg_bruto_descartable?: string
    peso_tara_descartable_kg?: string
    kg_neto_descartable?: string
  }>
}

const getMesasStorageKey = (loteId: string) => `clasificacion-cuadros-${loteId}`

export default function LoteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const roles = useAuthStore((state) => state.roles)
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [empaquetados, setEmpaquetados] = useState<Empaquetado[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [cuadrosLocales, setCuadrosLocales] = useState<CuadroLocal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const [l, cls, emp, des] = await Promise.all([
        getLote(id),
        getClasificacionesPorLote(id),
        getEmpaquetadosPorLote(id),
        getDespachosPorLote(id),
      ])
      setLote(l); setClasificaciones(cls); setEmpaquetados(emp); setDespachos(des)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (!id) return
    try {
      const raw = localStorage.getItem(getMesasStorageKey(id))
      if (!raw) { setCuadrosLocales(null); return }
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) { setCuadrosLocales(null); return }
      setCuadrosLocales(parsed.filter((item) => item && typeof item === 'object') as CuadroLocal[])
    } catch { setCuadrosLocales(null) }
  }, [id])

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  const canPrintLoteTicket = hasPermission(roles, APP_PERMISSIONS.LOTES_PRINT_TICKET)
  const canPrintLoteLabels = hasPermission(roles, APP_PERMISSIONS.LOTES_PRINT_LABELS)
  const canProcessLote = hasPermission(roles, APP_PERMISSIONS.LOTES_PROCESS)
  const canDispatchLote = hasPermission(roles, APP_PERMISSIONS.LOTES_DISPATCH)

  const acopiadorNombre = lote.acopiador
    ? `${lote.acopiador.apellido}, ${lote.acopiador.nombre}`
    : lote.acopiador_agricultor
      ? `${lote.acopiador_agricultor.apellido}, ${lote.acopiador_agricultor.nombre}`
      : '-'
  const pesoPorJaba = calcularPesoPorJaba(lote.peso_neto_kg, lote.num_cubetas)

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`Lote ${lote.codigo}`}
        description={`${lote.centro_acopio?.nombre ?? '-'} · ${formatFecha(lote.fecha_ingreso)}${lote.codigo_lote_agricultor ? ` · Cod. agricultor: ${lote.codigo_lote_agricultor}` : ''}${lote.sublote ? ` · Sublote: ${lote.sublote}` : ''} · N° JABAS INGRESADAS: ${lote.num_cubetas}${lote.jabas_prestadas > 0 ? ` · Jabas prestadas: ${lote.jabas_prestadas}` : ''} · Bruto: ${formatPeso(lote.peso_bruto_kg)} · Tara: ${formatPeso(lote.peso_tara_kg)} · Neto: ${formatPeso(lote.peso_neto_kg)} · Peso/jaba: ${formatPeso(pesoPorJaba)}`}
        backHref={ROUTES.LOTES}
        actions={
          <div className="flex gap-2">
            {canPrintLoteTicket && (
              <Button
                variant="outline"
                onClick={() => printLoteTicket(lote)}
              >
                <Printer className="h-4 w-4" /> Imprimir ticket
              </Button>
            )}
            {canProcessLote && (lote.estado === 'ingresado' || lote.estado === 'en_clasificacion') && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/lotes/${id}/clasificar`)}
              >
                Clasificar
              </Button>
            )}
            {canProcessLote && lote.estado === 'clasificado' && (
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/lotes/${id}/empaquetar`)}
              >
                Empaquetar
              </Button>
            )}
            {canProcessLote && lote.estado === 'empaquetado' && (
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/lotes/${id}/empaquetar`)}
              >
                Empaquetar
              </Button>
            )}
            {canDispatchLote && lote.estado === 'en_despacho' && (
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm"
                onClick={() => navigate(ROUTES.DESPACHOS_NUEVO)}
              >
                Registrar despacho
              </Button>
            )}
            {canDispatchLote && lote.estado === 'despachado' && (
              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/liquidaciones/agricultores/nueva?agricultor_id=${lote.agricultor_id}`)}
              >
                Crear liquidación
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle className="text-base">Estado del lote</CardTitle></CardHeader>
            <CardContent>
              <LoteTimeline estadoActual={lote.estado} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Info general */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Información general</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Personas</p>
                    <EstadoLoteBadge estado={lote.estado} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Agricultor</p>
                    <p className="font-medium">{lote.agricultor?.apellido}, {lote.agricultor?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Acopiador</p>
                    <p className="font-medium">{acopiadorNombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recepcionista</p>
                    <p className="font-medium">{lote.recepcionista ? `${lote.recepcionista.apellido}, ${lote.recepcionista.nombre}` : '-'}</p>
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Producto</p>
                  {lote.producto ? (
                    <div className="space-y-1">
                      <p className="font-semibold leading-tight">{lote.producto.nombre}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                        <p className="text-muted-foreground">Código</p>
                        <p>{lote.producto.codigo}</p>
                        <p className="text-muted-foreground">Variedad</p>
                        <p>{VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label}</p>
                        <p className="text-muted-foreground">Calidad</p>
                        <p>{CALIDAD_PRODUCTO_CONFIG[lote.producto.calidad].label}</p>
                        <p className="text-muted-foreground">Tipo</p>
                        <p>{TIPO_PRODUCCION_CONFIG[lote.producto.tipo_produccion].label}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="font-medium">-</p>
                  )}
                </section>

                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Logística</p>
                  {lote.codigo_lote_agricultor && (
                    <div>
                      <p className="text-xs text-muted-foreground">Código de agricultor</p>
                      <p className="font-medium">{lote.codigo_lote_agricultor}</p>
                    </div>
                  )}
                  {lote.sublote && (
                    <div>
                      <p className="text-xs text-muted-foreground">Sublote</p>
                      <p className="font-medium">{lote.sublote}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Centro de acopio</p>
                    <p className="font-medium">{lote.centro_acopio?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha ingreso</p>
                    <p className="font-medium">{formatFecha(lote.fecha_ingreso)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha cosecha</p>
                    <p className="font-medium">{formatFecha(lote.fecha_cosecha)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">N° Jabas ingresadas</p>
                    <p className="font-medium">{lote.num_cubetas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jabas prestadas (por devolver)</p>
                    <p className="font-medium">{lote.jabas_prestadas ?? 0}</p>
                  </div>
                </section>

                <section className="md:col-span-2 rounded-xl border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Pesos del lote</p>
                    <span className="rounded-full bg-primary/10 text-primary px-3 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                      {lote.num_cubetas} jabas
                    </span>
                  </div>

                  {/* Fila principal: Neto + Peso por jaba */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-primary px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/70">Neto</p>
                      <p className="mt-1 text-3xl font-extrabold leading-tight text-primary-foreground tracking-tight">{formatPeso(lote.peso_neto_kg)}</p>
                    </div>
                    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Peso por jaba</p>
                      <p className="mt-1 text-3xl font-extrabold leading-tight text-foreground tracking-tight">{formatPeso(pesoPorJaba)}</p>
                    </div>
                  </div>

                  {/* Fila secundaria: Bruto + Tara */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bruto</p>
                      <p className="mt-1 text-lg font-bold text-foreground">{formatPeso(lote.peso_bruto_kg)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tara × jaba</p>
                      <p className="mt-1 text-lg font-bold text-foreground">{formatPeso(lote.peso_tara_kg)}</p>
                    </div>
                  </div>
                </section>

                {lote.observaciones && (
                  <section className="md:col-span-2 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Observaciones</p>
                    <p className="mt-1">{lote.observaciones}</p>
                  </section>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Clasificación */}
          {clasificaciones.length > 0 && (() => {
            const sesion = clasificaciones[0]
            const aportesOriginales = sesion.aportes ?? []
            const filasLocalesPorColaborador = new Map(
              (cuadrosLocales ?? [])
                .flatMap((cuadro) => cuadro.filas ?? [])
                .filter((fila) => Boolean(fila.colaborador_id))
                .map((fila) => [fila.colaborador_id, fila])
            )
            const aportes = aportesOriginales.map((aporte) => {
              const filaLocal = filasLocalesPorColaborador.get(aporte.colaborador_id)
              const kgBruto = aporte.kg_bruto ?? toNumber(filaLocal?.kg_bruto)
              const numJabas = aporte.num_jabas ?? Math.max(0, Math.trunc(toNumber(filaLocal?.num_jabas)))
              const pesoTaraKg = aporte.peso_tara_kg > 0
                ? aporte.peso_tara_kg
                : toNumber(filaLocal?.peso_tara_kg) || lote.peso_tara_kg
              const kgBrutoDescartable = aporte.kg_bruto_descartable ?? toNumber(filaLocal?.kg_bruto_descartable)
              const jabasDescartadas = aporte.jabas_descartadas ?? Math.max(0, Math.trunc(toNumber(filaLocal?.jabas_descartadas)))
              const pesoTaraDescartableKg = aporte.peso_tara_descartable_kg > 0
                ? aporte.peso_tara_descartable_kg
                : toNumber(filaLocal?.peso_tara_descartable_kg) || lote.peso_tara_kg
              return {
                ...aporte,
                kg_bruto: kgBruto,
                num_jabas: numJabas,
                peso_tara_kg: pesoTaraKg,
                peso_bueno_kg: calcularNetoPorTara(kgBruto, numJabas, pesoTaraKg),
                kg_bruto_descartable: kgBrutoDescartable,
                jabas_descartadas: jabasDescartadas,
                peso_tara_descartable_kg: pesoTaraDescartableKg,
                kg_neto_descartable: calcularNetoPorTara(kgBrutoDescartable, jabasDescartadas, pesoTaraDescartableKg),
              }
            })
            const aportesPorColaborador = new Map(aportes.map((a) => [a.colaborador_id, a]))
            const calidad = lote.producto?.calidad ?? 'cat1'
            const totalBrutoClasif = aportes.reduce((s, a) => s + (a.kg_bruto ?? 0), 0)
            const totalNumJabas = aportes.reduce((s, a) => s + (a.num_jabas ?? 0), 0)
            const totalJabasDesc = aportes.reduce((s, a) => s + (a.jabas_descartadas ?? 0), 0)
            const totalBrutoDesc = aportes.reduce((s, a) => s + (a.kg_bruto_descartable ?? 0), 0)
            const totalNetoDesc = aportes.reduce((s, a) => s + (a.kg_neto_descartable ?? 0), 0)
            const totalMerma = Math.max(0, lote.peso_neto_kg - (sesion.peso_bueno_kg + totalNetoDesc))
            const aportesAgrupadosPorMesa = (cuadrosLocales ?? [])
              .map((cuadro, index) => ({
                index,
                aportes: (cuadro.filas ?? [])
                  .map((f) => aportesPorColaborador.get(f.colaborador_id))
                  .filter((a): a is NonNullable<typeof a> => Boolean(a)),
              }))
              .filter((mesa) => mesa.aportes.length > 0)

            const renderAporteRow = (a: NonNullable<(typeof aportes)[0]>) => (
              <div key={a.id} className="text-sm border rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {a.colaborador
                      ? `${a.colaborador.apellido}, ${a.colaborador.nombre}`
                      : a.colaborador_id}
                  </span>
                  <span className="text-xs text-primary font-medium">{formatMoneda(calcularPagoSeleccionador(a.peso_bueno_kg, calidad))}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs text-muted-foreground">
                  <div><span className="block text-[10px]">Kg brutos</span><span className="font-medium text-foreground">{formatPeso(a.kg_bruto ?? 0)}</span></div>
                  <div><span className="block text-[10px]">Cantidad de jabas</span><span className="font-medium text-foreground">{a.num_jabas ?? 0}</span></div>
                  <div><span className="block text-[10px]">Peso tara</span><span className="font-medium text-foreground">{formatPeso(a.peso_tara_kg ?? 0)}</span></div>
                  <div><span className="block text-[10px]">Kg exportables</span><span className="font-medium text-green-700">{formatPeso(a.peso_bueno_kg)}</span></div>
                  <div><span className="block text-[10px]">Kg bruto descarte</span><span className="font-medium text-foreground">{formatPeso(a.kg_bruto_descartable ?? 0)}</span></div>
                  <div><span className="block text-[10px]">Jabas descarte</span><span className="font-medium text-foreground">{a.jabas_descartadas ?? 0}</span></div>
                  <div><span className="block text-[10px]">Peso tara descarte</span><span className="font-medium text-foreground">{formatPeso(a.peso_tara_descartable_kg ?? lote.peso_tara_kg ?? 0)}</span></div>
                  <div><span className="block text-[10px]">Kg neto descarte</span><span className="font-medium text-foreground">{formatPeso(a.kg_neto_descartable ?? 0)}</span></div>
                </div>
              </div>
            )

            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Clasificación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 text-sm">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                      <p className="text-xs text-green-700 mb-0.5">Kg brutos</p>
                      <p className="font-bold text-lg text-green-700">{formatPeso(totalBrutoClasif)}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                      <p className="text-xs text-green-700 mb-0.5">Cantidad de jabas</p>
                      <p className="font-bold text-lg text-green-700">{totalNumJabas}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                      <p className="text-xs text-green-700 mb-0.5">Kg exportables</p>
                      <p className="font-bold text-lg text-green-700">{formatPeso(sesion.peso_bueno_kg)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                      <p className="text-xs text-red-700 mb-0.5">Kg bruto descarte</p>
                      <p className="font-bold text-lg text-red-700">{formatPeso(totalBrutoDesc)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                      <p className="text-xs text-red-700 mb-0.5">Jabas descarte</p>
                      <p className="font-bold text-lg text-red-700">{totalJabasDesc}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                      <p className="text-xs text-red-700 mb-0.5">Kg neto descarte</p>
                      <p className="font-bold text-lg text-red-700">{formatPeso(totalNetoDesc)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
                    <div className="rounded-lg bg-muted/30 border p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Neto ingresado</p>
                      <p className="font-bold text-lg">{formatPeso(lote.peso_neto_kg)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 border p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Descarte</p>
                      <p className="font-bold text-lg">{formatPeso(totalNetoDesc)}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <p className="text-xs text-amber-700 mb-0.5">Merma</p>
                      <p className="font-bold text-lg text-amber-700">{formatPeso(totalMerma)}</p>
                    </div>
                  </div>
                  {aportes.length > 0 && aportesAgrupadosPorMesa.length === 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Por seleccionador</p>
                      {aportes.map(renderAporteRow)}
                    </div>
                  )}
                  {aportesAgrupadosPorMesa.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por mesa</p>
                      {aportesAgrupadosPorMesa.map((mesa) => (
                        <div key={mesa.index} className="flex flex-col gap-1.5">
                          <p className="text-xs text-muted-foreground">Mesa {mesa.index + 1}</p>
                          {mesa.aportes.map(renderAporteRow)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Empaquetado */}
          {empaquetados.length > 0 && (() => {
            const totalCajas = empaquetados.reduce((acc, item) => acc + item.num_cajas, 0)
            const pallets = new Map<string, number>()
            for (const item of empaquetados) {
              const palletNormalizado = normalizarNumeroPallet(item.numero_pallet)
              pallets.set(palletNormalizado, (pallets.get(palletNormalizado) ?? 0) + item.num_cajas)
            }
            return (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Empaquetado</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                    <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-center">
                      <p className="text-xs text-indigo-700 mb-0.5">Cajas empaquetadas</p>
                      <p className="font-bold text-lg text-indigo-700">{totalCajas}</p>
                    </div>
                    <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-center">
                      <p className="text-xs text-sky-700 mb-0.5">Pallets usados</p>
                      <p className="font-bold text-lg text-sky-700">{pallets.size}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {empaquetados.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <span className="font-medium">Pallet {normalizarNumeroPallet(item.numero_pallet)}</span>
                            <span className="text-muted-foreground ml-2">{formatFecha(item.fecha_empaquetado)}</span>
                            <div className="flex gap-4 mt-1 text-muted-foreground">
                              <span>{item.num_cajas} cajas</span>
                              <span className="text-foreground font-medium uppercase">{item.destino}</span>
                            </div>
                            {item.colaborador && (
                              <p className="text-xs mt-0.5">
                                <span className="text-muted-foreground">Empaquetador: </span>
                                <span className="font-medium text-indigo-700">{item.colaborador.apellido}, {item.colaborador.nombre}</span>
                              </p>
                            )}
                            <p className="font-mono text-xs text-muted-foreground mt-0.5">Traz.: {item.codigo_trazabilidad}</p>
                          </div>
                          {canPrintLoteLabels && (
                            <Button variant="ghost" size="icon" title="Imprimir etiqueta" onClick={() => printEmpaquetadoLabel(lote, item)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Despachos */}
          {despachos.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Despacho{despachos.length > 1 ? 's' : ''}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                {despachos.map((d) => (
                  <div key={d.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{DESTINO_DESPACHO_CONFIG[d.destino].label}</span>
                        <span className="text-muted-foreground ml-2">{formatFecha(d.fecha_despacho)}</span>
                        <div className="flex gap-4 mt-1 text-muted-foreground">
                          <span>{d.num_cajas_despachadas} cajas · {formatPeso(d.peso_neto_kg)}</span>
                          <span className="text-foreground font-medium">{d.exportador || 'Sin exportador'}</span>
                        </div>
                        <p className="text-muted-foreground text-xs mt-0.5">Vía: {TIPO_DESPACHO_CONFIG[d.tipo_despacho]?.label ?? d.tipo_despacho}{d.marca_caja ? ` · Marca: ${d.marca_caja}` : ''}{d.transportista ? ` · Transportista: ${d.transportista}` : ''}{d.placa_vehiculo ? ` · ${d.placa_vehiculo}` : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
