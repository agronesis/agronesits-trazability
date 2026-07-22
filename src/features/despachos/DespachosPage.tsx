import { useEffect, useMemo, useState } from 'react'
import { Search, Truck } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { getLotesConDespachoPreasignado, type LoteDespachoPreasignado } from '@/services/despachos.service'
import { formatFecha } from '@/utils/formatters'

type GrupoDespacho = {
  numero: string
  lotes: LoteDespachoPreasignado[]
  totalCajas: number
  pallets: string[]
  resumenVariedad: { snow_peas: number; sugar: number }
  fechas: string[]
}

function cajasDelLote(lote: LoteDespachoPreasignado): number {
  const empaquetadas = (lote.empaquetados ?? []).reduce((acc, item) => acc + (item.num_cajas ?? 0), 0)
  return empaquetadas > 0 ? empaquetadas : (lote.cajas_preasignadas ?? 0)
}

function nombreAgricultor(lote: LoteDespachoPreasignado): string {
  if (!lote.agricultor) return 'Sin agricultor'
  return `${lote.agricultor.apellido}, ${lote.agricultor.nombre}`
}

function codigoVisible(lote: LoteDespachoPreasignado): string {
  return `${lote.codigo_lote_agricultor ?? lote.codigo}${lote.sublote ? ` - ${lote.sublote}` : ''}`
}

export default function DespachosPage() {
  const [lotes, setLotes] = useState<LoteDespachoPreasignado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      setLotes(await getLotesConDespachoPreasignado())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const grupos = useMemo<GrupoDespacho[]>(() => {
    const mapa = new Map<string, GrupoDespacho>()

    for (const lote of lotes) {
      const numero = lote.despacho_preasignado
      if (!mapa.has(numero)) {
        mapa.set(numero, {
          numero,
          lotes: [],
          totalCajas: 0,
          pallets: [],
          resumenVariedad: { snow_peas: 0, sugar: 0 },
          fechas: [],
        })
      }

      const grupo = mapa.get(numero)!
      grupo.lotes.push(lote)

      const cajas = cajasDelLote(lote)
      grupo.totalCajas += cajas

      const variedad = lote.producto?.variedad
      if (variedad === 'snow_peas' || variedad === 'sugar') {
        grupo.resumenVariedad[variedad] += cajas
      }

      if (lote.pallet_preasignado && !grupo.pallets.includes(lote.pallet_preasignado)) {
        grupo.pallets.push(lote.pallet_preasignado)
      }
      for (const emp of lote.empaquetados ?? []) {
        if (emp.fecha_empaquetado && !grupo.fechas.includes(emp.fecha_empaquetado)) {
          grupo.fechas.push(emp.fecha_empaquetado)
        }
      }
    }

    return Array.from(mapa.values())
      .map((grupo) => ({
        ...grupo,
        pallets: [...grupo.pallets].sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)),
        fechas: [...grupo.fechas].sort(),
        lotes: [...grupo.lotes].sort((a, b) => codigoVisible(a).localeCompare(codigoVisible(b))),
      }))
      .sort((a, b) => {
        const na = parseInt(a.numero, 10)
        const nb = parseInt(b.numero, 10)
        if (!isNaN(na) && !isNaN(nb)) return nb - na
        return b.numero.localeCompare(a.numero)
      })
  }, [lotes])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return grupos
    return grupos.filter((grupo) =>
      grupo.numero.toLowerCase().includes(q) ||
      grupo.pallets.some((pallet) => pallet.toLowerCase().includes(q)) ||
      grupo.lotes.some((lote) =>
        codigoVisible(lote).toLowerCase().includes(q) ||
        nombreAgricultor(lote).toLowerCase().includes(q)
      )
    )
  }, [busqueda, grupos])

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  return (
    <div>
      <PageHeader
        title="Despachos"
        description="Despachos generados desde la asignación de pallets en Empaquetado."
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por N° despacho, lote, agricultor o pallet..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-8 w-8" />}
          title="Sin despachos"
          description="Los despachos aparecerán aquí al asignar pallets con N° de despacho en Empaquetado."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((grupo) => (
            <Card key={grupo.numero}>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                    <Truck className="h-4 w-4" />
                    Despacho {grupo.numero}
                  </span>
                  {grupo.fechas.map((fecha) => (
                    <span key={fecha} className="text-xs text-muted-foreground">{formatFecha(fecha)}</span>
                  ))}
                  <span className="ml-auto text-sm font-bold">{grupo.totalCajas} cajas</span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {grupo.lotes.length} lote{grupo.lotes.length !== 1 ? 's' : ''} · Pallet{grupo.pallets.length !== 1 ? 's' : ''} {grupo.pallets.join(', ') || '-'}
                  {' · '}
                  {VARIEDAD_PRODUCTO_CONFIG.snow_peas.label}: <strong className="text-foreground">{grupo.resumenVariedad.snow_peas}</strong>
                  {' · '}
                  {VARIEDAD_PRODUCTO_CONFIG.sugar.label}: <strong className="text-foreground">{grupo.resumenVariedad.sugar}</strong>
                </p>

                <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {grupo.lotes.map((lote) => (
                    <div key={lote.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-semibold">{codigoVisible(lote)}</span>
                      <span className="text-xs text-muted-foreground">{nombreAgricultor(lote)}</span>
                      {lote.producto?.variedad && (
                        <span className="text-xs text-muted-foreground">
                          {VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        Pallet {lote.pallet_preasignado ?? '-'}
                      </span>
                      <span className="text-sm font-semibold">{cajasDelLote(lote)} cajas</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
