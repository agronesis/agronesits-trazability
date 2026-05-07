import React, { useEffect, useState } from 'react'
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import { endOfMonth, format, startOfMonth, subDays } from 'date-fns'
import { Boxes, CalendarRange, Package, Trash2, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPage } from '@/components/shared/Spinner'
import { formatPeso } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { supabase } from '@/lib/supabase'
import { getLotes } from '@/services/lotes.service'
import type { Lote, VariedadProducto } from '@/types/models'

type FiltroModo = 'dia' | 'rango'
type FiltroVariedad = 'all' | VariedadProducto

type DashboardClasificacionAporteRow = {
  kg_neto_descartable: number | null
}

type DashboardClasificacionRow = {
  lote_id: string
  peso_bueno_kg: number | null
  aportes?: DashboardClasificacionAporteRow[] | null
}

type DashboardMetricRow = {
  id: string
  fecha: string
  variedad: VariedadProducto
  ingresado: number
  exportable: number
  descarte: number
  merma: number
}

interface StatCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
}

type PieMetricKey = 'ingresado' | 'exportable' | 'descarte'

type PieMetricDatum = {
  name: string
  value: number
  percentage: number
  color: string
}

function StatCard({ title, value, sub, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-agro-green/10 flex items-center justify-center text-agro-green">
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{title}</p>
          <p className="font-bold text-xl">{value}</p>
          {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

const VARIEDAD_COLORS: Record<VariedadProducto, string> = {
  snow_peas: '#1d4ed8',
  sugar: '#16a34a',
}

function PorcentajePieCard({
  title,
  description,
  totalLabel,
  data,
}: {
  title: string
  description: string
  totalLabel: string
  data: PieMetricDatum[]
}) {
  const total = roundTo2(data.reduce((acc, item) => acc + item.value, 0))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-4 items-center">
            <div className="h-[245px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={68}
                    outerRadius={104}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={3}
                    labelLine={false}
                  >
                    {data.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={((value: unknown, _name: unknown, item: { payload?: PieMetricDatum }) => {
                    const metricValue = Number(value ?? 0)
                    const percentage = item?.payload?.percentage ?? 0
                    return [`${metricValue.toFixed(2)} kg · ${percentage.toFixed(1)}%`, item?.payload?.name ?? '']
                  }) as never} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{totalLabel}</p>
                <p className="mt-1 text-2xl font-bold">{total.toFixed(2)} kg</p>
              </div>
              <div className="space-y-2">
                {data.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.percentage.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">{item.value.toFixed(2)} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[280px] rounded-xl border border-dashed bg-muted/10 flex items-center justify-center text-sm text-muted-foreground">
            No hay datos suficientes en el filtro actual para este gráfico.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const roundTo2 = (value: number) => Math.round(value * 100) / 100
const toNumber = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0
const today = format(new Date(), 'yyyy-MM-dd')
const initialStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
const initialEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

function buildMetricRow(lote: Lote, clasificaciones: DashboardClasificacionRow[]): DashboardMetricRow | null {
  const variedad = lote.producto?.variedad
  if (!variedad || !lote.fecha_ingreso) return null

  const exportable = roundTo2(clasificaciones.reduce((acc, clasificacion) => acc + toNumber(clasificacion.peso_bueno_kg), 0))
  const descarte = roundTo2(clasificaciones.reduce(
    (acc, clasificacion) => acc + (clasificacion.aportes ?? []).reduce((sum, aporte) => sum + toNumber(aporte.kg_neto_descartable), 0),
    0
  ))
  const ingresado = roundTo2(toNumber(lote.peso_neto_kg))
  const merma = roundTo2(Math.max(0, ingresado - (exportable + descarte)))

  return {
    id: lote.id,
    fecha: lote.fecha_ingreso.slice(0, 10),
    variedad,
    ingresado,
    exportable,
    descarte,
    merma,
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DashboardMetricRow[]>([])
  const [filterMode, setFilterMode] = useState<FiltroModo>('rango')
  const [selectedDay, setSelectedDay] = useState(today)
  const [fechaInicio, setFechaInicio] = useState(initialStart)
  const [fechaFin, setFechaFin] = useState(initialEnd)
  const [variedadFiltro, setVariedadFiltro] = useState<FiltroVariedad>('all')

  useEffect(() => {
    const cargar = async () => {
      try {
        const [lotes, clasificacionesResult] = await Promise.all([
          getLotes(),
          supabase
            .from('clasificaciones')
            .select(`
              lote_id,
              peso_bueno_kg,
              aportes:clasificacion_aportes(kg_neto_descartable)
            `)
            .order('created_at', { ascending: true }),
        ])

        if (clasificacionesResult.error) throw clasificacionesResult.error

        const clasificacionesRows = (clasificacionesResult.data ?? []) as DashboardClasificacionRow[]

        const clasificacionesPorLote = clasificacionesRows.reduce<Record<string, DashboardClasificacionRow[]>>((acc, row) => {
          const loteId = row.lote_id
          if (!loteId) return acc
          if (!acc[loteId]) acc[loteId] = []
          acc[loteId].push(row)
          return acc
        }, {})

        const metricRows = lotes
          .map((lote) => buildMetricRow(lote, clasificacionesPorLote[lote.id] ?? []))
          .filter((row): row is DashboardMetricRow => Boolean(row))

        setRows(metricRows)
      } catch (e) {
        console.error('Dashboard error:', e)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  if (loading) return <LoadingPage />

  const rangoInicio = filterMode === 'dia' ? selectedDay : fechaInicio
  const rangoFin = filterMode === 'dia' ? selectedDay : fechaFin
  const hasValidRange = rangoInicio <= rangoFin

  const filteredRows = hasValidRange
    ? rows.filter((row) => {
        const matchesVariedad = variedadFiltro === 'all' || row.variedad === variedadFiltro
        const matchesFecha = row.fecha >= rangoInicio && row.fecha <= rangoFin
        return matchesVariedad && matchesFecha
      })
    : []

  const resumenPorVariedad = (['snow_peas', 'sugar'] as const)
    .map((variedad) => {
      const items = filteredRows.filter((row) => row.variedad === variedad)
      return {
        variedad,
        label: VARIEDAD_PRODUCTO_CONFIG[variedad].label,
        lotes: items.length,
        ingresado: roundTo2(items.reduce((acc, row) => acc + row.ingresado, 0)),
        exportable: roundTo2(items.reduce((acc, row) => acc + row.exportable, 0)),
        descarte: roundTo2(items.reduce((acc, row) => acc + row.descarte, 0)),
        merma: roundTo2(items.reduce((acc, row) => acc + row.merma, 0)),
      }
    })
    .filter((item) => variedadFiltro === 'all' || item.variedad === variedadFiltro)

  const totals = filteredRows.reduce((acc, row) => ({
    lotes: acc.lotes + 1,
    ingresado: roundTo2(acc.ingresado + row.ingresado),
    exportable: roundTo2(acc.exportable + row.exportable),
    descarte: roundTo2(acc.descarte + row.descarte),
    merma: roundTo2(acc.merma + row.merma),
  }), {
    lotes: 0,
    ingresado: 0,
    exportable: 0,
    descarte: 0,
    merma: 0,
  })

  const buildPieMetricData = (metric: PieMetricKey): PieMetricDatum[] => {
    const total = resumenPorVariedad.reduce((acc, item) => acc + item[metric], 0)

    return resumenPorVariedad
      .filter((item) => item[metric] > 0)
      .map((item) => ({
        name: item.label,
        value: roundTo2(item[metric]),
        percentage: total > 0 ? roundTo2((item[metric] / total) * 100) : 0,
        color: VARIEDAD_COLORS[item.variedad],
      }))
  }

  const pieIngresado = buildPieMetricData('ingresado')
  const pieExportable = buildPieMetricData('exportable')
  const pieDescarte = buildPieMetricData('descarte')

  const aplicarHoy = () => {
    setFilterMode('dia')
    setSelectedDay(today)
  }

  const aplicarUltimos7 = () => {
    setFilterMode('rango')
    setFechaInicio(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
    setFechaFin(today)
  }

  const aplicarMesActual = () => {
    setFilterMode('rango')
    setFechaInicio(initialStart)
    setFechaFin(initialEnd)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Indicadores de ingreso, clasificación y merma por variedad sobre la fecha de ingreso del lote.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Consulta un día puntual o un rango de fechas y segmenta por variedad.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={aplicarHoy}>Hoy</Button>
            <Button type="button" variant="outline" size="sm" onClick={aplicarUltimos7}>Últimos 7 días</Button>
            <Button type="button" variant="outline" size="sm" onClick={aplicarMesActual}>Mes actual</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label="Modo de consulta">
              <Select value={filterMode} onValueChange={(value) => setFilterMode(value as FiltroModo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Por día</SelectItem>
                  <SelectItem value="rango">Rango de fechas</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {filterMode === 'dia' ? (
              <FormField label="Día">
                <Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
              </FormField>
            ) : (
              <>
                <FormField label="Desde">
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </FormField>
                <FormField label="Hasta">
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </FormField>
              </>
            )}

            <FormField label="Variedad">
              <Select value={variedadFiltro} onValueChange={(value) => setVariedadFiltro(value as FiltroVariedad)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las variedades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las variedades</SelectItem>
                  <SelectItem value="snow_peas">Snow Peas</SelectItem>
                  <SelectItem value="sugar">Sugar Snap</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {!hasValidRange && (
            <p className="text-sm text-destructive">La fecha inicial no puede ser mayor que la fecha final.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard title="Lotes en filtro" value={String(totals.lotes)} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Kg netos ingresados" value={formatPeso(totals.ingresado)} icon={<CalendarRange className="h-5 w-5" />} />
        <StatCard title="Kg exportables" value={formatPeso(totals.exportable)} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Kg de descarte" value={formatPeso(totals.descarte)} icon={<Trash2 className="h-5 w-5" />} />
        <StatCard title="Merma" value={formatPeso(totals.merma)} sub="Ingresado - (exportable + descarte)" icon={<TrendingDown className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen por variedad</CardTitle>
          <CardDescription>Totales acumulados en el filtro actual para Snow Peas y Sugar Snap.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {resumenPorVariedad.map((item) => (
              <div key={item.variedad} className="rounded-xl border p-4 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{item.label}</h3>
                    <p className="text-xs text-muted-foreground">{item.lotes} lote(s) en el rango seleccionado</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/20 border p-3">
                    <p className="text-xs text-muted-foreground">Kg netos ingresados</p>
                    <p className="font-bold mt-1">{formatPeso(item.ingresado)}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-xs text-green-700">Kg exportables</p>
                    <p className="font-bold mt-1 text-green-700">{formatPeso(item.exportable)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs text-red-700">Kg de descarte</p>
                    <p className="font-bold mt-1 text-red-700">{formatPeso(item.descarte)}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs text-amber-700">Merma</p>
                    <p className="font-bold mt-1 text-amber-700">{formatPeso(item.merma)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PorcentajePieCard
          title="Ingresado por variedad"
          description="Porcentaje de kg netos ingresados por variedad en el día o rango seleccionado."
          totalLabel="Total ingresado"
          data={pieIngresado}
        />
        <PorcentajePieCard
          title="Exportable por variedad"
          description="Distribución porcentual de kg exportables según el filtro aplicado."
          totalLabel="Total exportable"
          data={pieExportable}
        />
        <PorcentajePieCard
          title="Descarte por variedad"
          description="Participación porcentual del descarte por variedad dentro del filtro actual."
          totalLabel="Total descarte"
          data={pieDescarte}
        />
      </div>

      {filteredRows.length === 0 && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
            No hay lotes dentro del filtro actual para calcular ingreso, exportable, descarte y merma.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
