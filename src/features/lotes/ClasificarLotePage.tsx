import { useState, useEffect, useId } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import { getClasificacionesPorLote, guardarClasificacion } from '@/services/clasificaciones.service'
import { logAudit } from '@/services/audit.service'
import { getColaboradores } from '@/services/colaboradores.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { ToastContainer, useToast } from '@/components/shared/Toast'
import { ColaboradorPicker } from '@/components/shared/ColaboradorPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth.store'
import { formatPeso } from '@/utils/formatters'
import { calcularPagoSeleccionador } from '@/utils/business-rules'
import { Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Lote, Colaborador } from '@/types/models'

const roundTo2 = (value: number) => Math.round(value * 100) / 100
const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const calcularNetoPorTara = (kgBruto: number, cantidadJabas: number, pesoTara: number) => roundTo2(Math.max(0, kgBruto - (cantidadJabas * pesoTara)))
const inferirJabas = (kgBruto: number, kgNeto: number, pesoTara: number) => {
  if (pesoTara <= 0) return 0
  const diferencia = roundTo2(kgBruto - kgNeto)
  if (diferencia <= 0) return 0
  return Math.max(0, Math.round(diferencia / pesoTara))
}

type Fila = {
  key: string
  colaborador_id: string
  kg_bruto: string
  num_jabas: string
  peso_tara_kg: string
  jabas_descartadas: string
  kg_bruto_descartable: string
  peso_tara_descartable_kg: string
}
type MesaBloque = { key: string; filas: Fila[] }

const getMesasStorageKey = (loteId: string) => `clasificacion-cuadros-${loteId}`

export default function ClasificarLotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const uid = useId()

  const crearFila = (suffix: string): Fila => ({
    key: `${uid}-f-${suffix}`,
    colaborador_id: '',
    kg_bruto: '',
    num_jabas: '',
    peso_tara_kg: '',
    jabas_descartadas: '',
    kg_bruto_descartable: '',
    peso_tara_descartable_kg: '',
  })

  const crearMesa = (suffix: string, conFilaInicial = true): MesaBloque => ({
    key: `${uid}-m-${suffix}`,
    filas: conFilaInicial ? [crearFila(`${suffix}-0`)] : [],
  })

  const [lote, setLote] = useState<Lote | null>(null)
  const [seleccionadores, setSeleccionadores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { toasts, toast, remove } = useToast()

  // Datos de la sesión
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [observaciones, setObservaciones] = useState('')
  const [mesas, setMesas] = useState<MesaBloque[]>([crearMesa('inicial')])

  const todasFilas = mesas.flatMap((m) => m.filas)
  const calidad = lote?.producto?.calidad ?? 'cat1'
  const metricasFilas = todasFilas.map((fila) => {
    const kgBruto = toNumber(fila.kg_bruto)
    const numJabas = Math.max(0, Math.trunc(toNumber(fila.num_jabas)))
    const pesoTaraKg = toNumber(fila.peso_tara_kg || lote?.peso_tara_kg)
    const kgExportable = calcularNetoPorTara(kgBruto, numJabas, pesoTaraKg)
    const kgBrutoDescarte = toNumber(fila.kg_bruto_descartable)
    const jabasDescartadas = Math.max(0, Math.trunc(toNumber(fila.jabas_descartadas)))
    const pesoTaraDescarteKg = toNumber(fila.peso_tara_descartable_kg || lote?.peso_tara_kg)
    const kgNetoDescartable = calcularNetoPorTara(kgBrutoDescarte, jabasDescartadas, pesoTaraDescarteKg)
    return {
      fila,
      kgBruto,
      numJabas,
      pesoTaraKg,
      kgExportable,
      kgBrutoDescarte,
      jabasDescartadas,
      pesoTaraDescarteKg,
      kgNetoDescartable,
    }
  })
  const totalExportables = metricasFilas.reduce((acc, item) => acc + item.kgExportable, 0)
  const totalNetoDescartable = metricasFilas.reduce((acc, item) => acc + item.kgNetoDescartable, 0)
  const totalMerma = Math.max(0, (lote?.peso_neto_kg ?? 0) - (totalExportables + totalNetoDescartable))
  const totalPagoSeleccionadores = metricasFilas.reduce((acc, item) =>
    acc + calcularPagoSeleccionador(item.kgExportable, calidad), 0)

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [l, colabs, [sesion]] = await Promise.all([
        getLote(id),
        getColaboradores(),
        getClasificacionesPorLote(id),
      ])
      setLote(l)
      setSeleccionadores(colabs.filter((c) => c.rol === 'seleccionador' && c.estado === 'activo'))

      if (sesion) {
        setFecha(sesion.fecha_clasificacion)
        setObservaciones(sesion.observaciones ?? '')
        const mesasCargadas: MesaBloque[] = [crearMesa('default')]

        const aportesCargados = (sesion.aportes ?? []).map((a, i) => ({
          key: `${uid}-loaded-${i}`,
          colaborador_id: a.colaborador_id,
          kg_bruto: String(a.kg_bruto ?? 0),
          num_jabas: String(a.num_jabas ?? inferirJabas(a.kg_bruto ?? 0, a.peso_bueno_kg, a.peso_tara_kg ?? l.peso_tara_kg ?? 0)),
          peso_tara_kg: String(a.peso_tara_kg ?? l.peso_tara_kg ?? 0),
          jabas_descartadas: String(a.jabas_descartadas ?? 0),
          kg_bruto_descartable: String(a.kg_bruto_descartable ?? 0),
          peso_tara_descartable_kg: String(a.peso_tara_descartable_kg ?? l.peso_tara_kg ?? 0),
        }))

        if (aportesCargados.length > 0) {
          mesasCargadas[0].filas = aportesCargados
        }

        // Mantener consistencia visual de cuadros al volver a abrir un borrador.
        try {
          const raw = localStorage.getItem(getMesasStorageKey(id))
          if (raw) {
            const parsed = JSON.parse(raw) as Array<{ filas: Array<{
              colaborador_id: string
              kg_bruto?: string
              num_jabas?: string
              peso_tara_kg?: string
              kg_exportable?: string
              kg_bueno?: string
              peso_bueno_kg?: string
              jabas_descartadas?: string
              kg_bruto_descartable?: string
              peso_tara_descartable_kg?: string
              peso_tara_kg_descarte?: string
              kg_neto_descartable?: string
            }> }>
            if (Array.isArray(parsed) && parsed.length > 0) {
              const mesasDesdeLocal: MesaBloque[] = parsed
                .map((m, i) => ({
                  key: `${uid}-mesa-local-${i}`,
                  filas: Array.isArray(m.filas)
                    ? m.filas.map((f, j) => ({
                        key: `${uid}-fila-local-${i}-${j}`,
                        colaborador_id: f.colaborador_id ?? '',
                        kg_bruto: String(f.kg_bruto ?? ''),
                        num_jabas: String(f.num_jabas ?? inferirJabas(toNumber(f.kg_bruto), toNumber(f.kg_exportable ?? f.kg_bueno ?? f.peso_bueno_kg), toNumber(f.peso_tara_kg ?? l.peso_tara_kg ?? 0))),
                        peso_tara_kg: String(f.peso_tara_kg ?? l.peso_tara_kg ?? ''),
                        jabas_descartadas: String(f.jabas_descartadas ?? ''),
                        kg_bruto_descartable: String(f.kg_bruto_descartable ?? ''),
                        peso_tara_descartable_kg: String(f.peso_tara_descartable_kg ?? f.peso_tara_kg_descarte ?? l.peso_tara_kg ?? ''),
                      }))
                    : [],
                }))
                .filter((m) => m.filas.length > 0)

              if (mesasDesdeLocal.length > 0) {
                setMesas(mesasDesdeLocal)
                setLoading(false)
                return
              }
            }
          }
        } catch {
          // Si localStorage falla o está corrupto, continuar con reconstrucción estándar.
        }

        setMesas(mesasCargadas)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (!formError) return
    const timeoutId = window.setTimeout(() => {
      setFormError(null)
    }, 4500)
    return () => window.clearTimeout(timeoutId)
  }, [formError])

  const agregarMesa = () => {
    setMesas((prev) => [
      ...prev,
      crearMesa(String(Date.now())),
    ])
  }

  const eliminarMesa = (mesaKey: string) => {
    setMesas((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((m) => m.key !== mesaKey)
    })
  }

  const agregarFilaEnMesa = (mesaKey: string) => {
    setMesas((prev) => prev.map((m) => (
      m.key === mesaKey
        ? {
            ...m,
            filas: [...m.filas, crearFila(String(Date.now()))],
          }
        : m
    )))
  }

  const eliminarFilaEnMesa = (mesaKey: string, filaKey: string) => {
    setMesas((prev) => prev.flatMap((m) => {
      if (m.key !== mesaKey) return [m]

      const totalFilasPrevias = prev.reduce((acc, mesa) => acc + mesa.filas.length, 0)
      if (totalFilasPrevias <= 1) return [m]

      const filasRestantes = m.filas.filter((f) => f.key !== filaKey)
      return filasRestantes.length > 0 ? [{ ...m, filas: filasRestantes }] : []
    }))
  }

  const actualizarFilaEnMesa = (mesaKey: string, filaKey: string, campo: keyof Omit<Fila, 'key'>, valor: string) => {
    setMesas((prev) => prev.map((m) => (
      m.key === mesaKey
        ? {
            ...m,
            filas: m.filas.map((f) => (f.key === filaKey ? { ...f, [campo]: valor } : f)),
          }
        : m
    )))
  }

  const handleGuardar = async (finalizarDespues = false) => {
    if (!lote || !user) return

    setFormError(null)

    const notifyFormError = (message: string) => {
      setFormError(message)
      toast('error', message)
    }

    const filasActuales = mesas.flatMap((m) => m.filas)

    const hayFilaIncompleta = filasActuales.some((f) => {
      const bruto = parseFloat(f.kg_bruto)
      const numJabas = parseFloat(f.num_jabas)
      const pesoTara = parseFloat(f.peso_tara_kg || String(lote.peso_tara_kg))
      return !f.colaborador_id
        || f.kg_bruto.trim() === '' || Number.isNaN(bruto) || bruto < 0
        || f.num_jabas.trim() === '' || Number.isNaN(numJabas) || numJabas < 0
        || (f.peso_tara_kg.trim() === '' && lote.peso_tara_kg <= 0) || Number.isNaN(pesoTara) || pesoTara < 0
    })

    const neto = lote.peso_neto_kg
    const brutoLote = lote.peso_bruto_kg

    const hayTaraPrincipalMayorQueBruto = metricasFilas.some((item) => (item.numJabas * item.pesoTaraKg) > item.kgBruto)
    const hayTaraDescarteMayorQueBruto = metricasFilas.some((item) => (item.jabasDescartadas * item.pesoTaraDescarteKg) > item.kgBrutoDescarte)
    const hayBrutoPrincipalMayorQueBrutoLote = metricasFilas.some((item) => item.kgBruto > brutoLote)
    const hayBrutoDescarteMayorQueBrutoLote = metricasFilas.some((item) => item.kgBrutoDescarte > brutoLote)
    const totalBrutoRegistrado = metricasFilas.reduce((acc, item) => acc + item.kgBruto + item.kgBrutoDescarte, 0)

    const hayBrutoMayorQueNeto = filasActuales.some((f) => {
      const bruto = parseFloat(f.kg_bruto) || 0
      return bruto > neto
    })

    if (mesas.length === 0) {
      notifyFormError('Debe agregar al menos un cuadro antes de guardar.')
      return
    }

    if (filasActuales.length === 0) {
      notifyFormError('Debe agregar al menos un seleccionador antes de guardar.')
      return
    }

    if (hayFilaIncompleta) {
      notifyFormError('Complete todos los trabajadores: seleccionador, kg brutos, cantidad de jabas y peso tara.')
      return
    }

    if (hayBrutoMayorQueNeto) {
      notifyFormError(`El kg bruto de un trabajador no puede ser mayor al neto del lote (${formatPeso(neto)}).`)
      return
    }

    if (hayBrutoPrincipalMayorQueBrutoLote) {
      notifyFormError(`El kg bruto principal no puede ser mayor al kg bruto del lote (${formatPeso(brutoLote)}).`)
      return
    }

    if (hayBrutoDescarteMayorQueBrutoLote) {
      notifyFormError(`El kg bruto descarte no puede ser mayor al kg bruto del lote (${formatPeso(brutoLote)}).`)
      return
    }

    if (totalBrutoRegistrado > brutoLote) {
      notifyFormError(`La suma de kg bruto principal y kg bruto descarte (${formatPeso(totalBrutoRegistrado)}) no puede superar el kg bruto del lote (${formatPeso(brutoLote)}).`)
      return
    }

    if (hayTaraPrincipalMayorQueBruto) {
      notifyFormError('La tara total de la fila principal no puede ser mayor que los kg brutos del trabajador.')
      return
    }

    if (hayTaraDescarteMayorQueBruto) {
      notifyFormError('La tara total del descarte no puede ser mayor que el kg bruto descarte del trabajador.')
      return
    }

    const filasValidas = metricasFilas.map((item) => ({
      colaborador_id: item.fila.colaborador_id,
      kg_bueno: item.kgExportable,
      kg_bruto: item.kgBruto,
      num_jabas: item.numJabas,
      peso_tara_kg: item.pesoTaraKg,
      jabas_descartadas: item.jabasDescartadas,
      kg_bruto_descartable: item.kgBrutoDescarte,
      peso_tara_descartable_kg: item.pesoTaraDescarteKg,
      kg_neto_descartable: item.kgNetoDescartable,
    }))

    const totalBuenosCalculado = filasValidas.reduce((acc, f) => acc + f.kg_bueno, 0)
    const totalDescarteCalculado = filasValidas.reduce((acc, f) => acc + f.kg_neto_descartable, 0)
    const totalClasificadoCalculado = totalBuenosCalculado + totalDescarteCalculado
    if (totalClasificadoCalculado > neto) {
      notifyFormError(`La suma de kg exportables y descarte (${formatPeso(totalClasificadoCalculado)}) no puede ser mayor al neto (${formatPeso(neto)}).`)
      return
    }

    setSaving(true)
    try {
      await guardarClasificacion(
        lote.id,
        fecha,
        observaciones || null,
        filasValidas,
        lote.producto?.calidad ?? 'cat1',
        user.id
      )

      if (id) {
        try {
          localStorage.setItem(
            getMesasStorageKey(id),
            JSON.stringify(
              mesas.map((m) => ({
                filas: m.filas.map((f) => ({
                  colaborador_id: f.colaborador_id,
                  kg_bruto: f.kg_bruto,
                  num_jabas: f.num_jabas,
                  peso_tara_kg: f.peso_tara_kg || String(lote.peso_tara_kg),
                  kg_exportable: String(calcularNetoPorTara(toNumber(f.kg_bruto), Math.max(0, Math.trunc(toNumber(f.num_jabas))), toNumber(f.peso_tara_kg || lote.peso_tara_kg))),
                  jabas_descartadas: f.jabas_descartadas,
                  kg_bruto_descartable: f.kg_bruto_descartable,
                  peso_tara_descartable_kg: f.peso_tara_descartable_kg || String(lote.peso_tara_kg),
                  kg_neto_descartable: String(calcularNetoPorTara(toNumber(f.kg_bruto_descartable), Math.max(0, Math.trunc(toNumber(f.jabas_descartadas))), toNumber(f.peso_tara_descartable_kg || lote.peso_tara_kg))),
                })),
              }))
            )
          )
        } catch {
          // No bloquear el flujo si el guardado local falla.
        }
      }

      if (lote.estado === 'ingresado') {
        await actualizarEstadoLote(lote.id, 'en_clasificacion')
      }

      if (finalizarDespues) {
        await actualizarEstadoLote(lote.id, 'clasificado')
        void logAudit({
          userId: user.id,
          userEmail: user.email ?? '',
          accion: 'actualizar',
          modulo: 'lotes',
          registroId: lote.id,
          descripcion: `Lote clasificado: ${lote.codigo}`,
          datosAnteriores: { estado: lote.estado },
          datosNuevos: { estado: 'clasificado' },
        })
        navigate(`/lotes/${id}`)
      } else {
        toast('success', 'Borrador guardado')
      }
    } catch (e) {
      notifyFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  const colaboradoresSeleccionados = new Set(mesas.flatMap((m) => m.filas.map((f) => f.colaborador_id)).filter(Boolean))

  return (
    <div className="max-w-4xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={remove} />

      <PageHeader
        title={`Clasificar – ${lote.codigo}`}
        backHref={`/lotes/${id}`}
        actions={
          <Button
            onClick={() => handleGuardar(true)}
            loading={saving}
            disabled={todasFilas.length === 0}
          >
            Finalizar clasificación
          </Button>
        }
      />

      {/* Resumen de pesos – se actualiza en tiempo real */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kg netos ingresado</p>
              <p className="mt-1 font-bold text-lg">{formatPeso(lote.peso_neto_kg)}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Kg exportables</p>
              <p className="mt-1 font-bold text-lg text-green-700">{formatPeso(totalExportables)}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Kg de descarte</p>
              <p className="mt-1 font-bold text-lg text-red-700">{formatPeso(totalNetoDescartable)}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Merma</p>
              <p className="mt-1 font-bold text-lg text-amber-700">{formatPeso(totalMerma)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de la sesión */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Datos de la sesión</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium">Observaciones</label>
            <Textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </CardContent>
      </Card>

      {/* Aportes por seleccionador (título único + cuadros duplicables) */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Aportes por seleccionador</h3>
          <Button variant="outline" size="sm" onClick={agregarMesa}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar cuadro
          </Button>
        </div>

        {mesas.map((mesa) => (
          <Card key={mesa.key}>
            <CardContent className="pt-4 space-y-3">
              {mesa.filas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No hay trabajadores en esta mesa.
                </p>
              )}

              {mesa.filas.map((fila, idx) => {
                const kgExportableFila = calcularNetoPorTara(
                  toNumber(fila.kg_bruto),
                  Math.max(0, Math.trunc(toNumber(fila.num_jabas))),
                  toNumber(fila.peso_tara_kg || lote.peso_tara_kg)
                )
                const kgNetoDescarteFila = calcularNetoPorTara(
                  toNumber(fila.kg_bruto_descartable),
                  Math.max(0, Math.trunc(toNumber(fila.jabas_descartadas))),
                  toNumber(fila.peso_tara_descartable_kg || lote.peso_tara_kg)
                )
                const pagoFila = calcularPagoSeleccionador(kgExportableFila, lote.producto?.calidad ?? 'cat1')
                return (
                <div key={fila.key} className="space-y-2 border rounded-lg p-3">
                  <div className="flex items-end gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-right mb-2">{idx + 1}.</span>
                    <div className="flex-1">
                      <ColaboradorPicker
                        value={fila.colaborador_id}
                        onChange={(v) => actualizarFilaEnMesa(mesa.key, fila.key, 'colaborador_id', v)}
                        colaboradores={seleccionadores}
                        disabledIds={colaboradoresSeleccionados}
                      />
                    </div>
                    <div className="w-20 text-right mb-1">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Pago</p>
                      <p className="text-sm font-semibold text-green-700">S/ {pagoFila.toFixed(2)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive mb-1"
                      onClick={() => eliminarFilaEnMesa(mesa.key, fila.key)}
                      disabled={todasFilas.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Kg brutos</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={fila.kg_bruto}
                        onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'kg_bruto', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Cantidad de jabas</p>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={fila.num_jabas}
                        onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'num_jabas', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Peso tara</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(lote.peso_tara_kg.toFixed(2))}
                        value={fila.peso_tara_kg}
                        onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'peso_tara_kg', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Kg exportables</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={kgExportableFila.toFixed(2)}
                        disabled
                        className="bg-muted/40 text-foreground disabled:opacity-100 disabled:text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Kg bruto descarte</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={fila.kg_bruto_descartable}
                        onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'kg_bruto_descartable', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Cantidad de jabas descarte</p>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={fila.jabas_descartadas}
                        onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'jabas_descartadas', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Peso tara</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(lote.peso_tara_kg.toFixed(2))}
                        value={fila.peso_tara_descartable_kg}
                        onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'peso_tara_descartable_kg', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Kg neto descarte</p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={kgNetoDescarteFila.toFixed(2)}
                        disabled
                        className="bg-muted/40 text-foreground disabled:opacity-100 disabled:text-foreground"
                      />
                    </div>
                  </div>
                </div>
                )
              })}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => agregarFilaEnMesa(mesa.key)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar trabajador
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => eliminarMesa(mesa.key)} disabled={mesas.length <= 1}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar cuadro
                </Button>
              </div>

            </CardContent>
          </Card>
        ))}

        <div className="flex justify-between pt-2 border-t text-sm">
          <span className="font-semibold text-green-700">Total exportables: {formatPeso(totalExportables)}</span>
          <span className="text-muted-foreground">Merma actual: <strong className="text-amber-700">{formatPeso(totalMerma)}</strong></span>
          <span className="text-muted-foreground">Pago est. seleccionadores: <strong className="text-green-700">S/ {totalPagoSeleccionadores.toFixed(2)}</strong></span>
        </div>
      </div>

        {formError && (
          <div className="mb-3 rounded-md border border-red-300 bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
            {formError}
          </div>
        )}

      <div className="flex justify-end gap-2 pb-8">
        <Button variant="outline" onClick={() => handleGuardar(false)} loading={saving}>
          Guardar borrador
        </Button>
        <Button
          onClick={() => handleGuardar(true)}
          loading={saving}
          disabled={todasFilas.length === 0}
        >
          Finalizar clasificación
        </Button>
      </div>
    </div>
  )
}

