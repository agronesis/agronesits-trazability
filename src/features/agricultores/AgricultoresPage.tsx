import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Phone, MapPin, LayoutGrid, List } from 'lucide-react'
import { useAgricultores } from './hooks/useAgricultores'
import { AgricultorForm } from './AgricultorForm'
import { getAgricultor } from '@/services/agricultores.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage, Spinner } from '@/components/shared/Spinner'
import { EstadoActivoBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { Agricultor } from '@/types/models'
import type { AgricultorFormData } from '@/utils/validators'
import { useAuthStore } from '@/store/auth.store'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'

export default function AgricultoresPage() {
  const { agricultores, loading, error, reload, crear, actualizar, eliminar } = useAgricultores()
  const roles = useAuthStore((state) => state.roles)
  const [busqueda, setBusqueda] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Agricultor | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [vista, setVista] = useState<'cards' | 'lista'>('lista')
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(12)
  const [aEliminar, setAEliminar] = useState<string | null>(null)
  const canManageAgricultores = hasPermission(roles, APP_PERMISSIONS.AGRICULTORES_MANAGE)

  const q = busqueda.trim().toLowerCase()
  const filtrados = agricultores
    .filter((a) =>
      `${a.nombre} ${a.apellido} ${a.codigo} ${a.dni ?? ''} ${a.numero_cuenta ?? ''} ${a.fecha_alta ?? ''}`
        .toLowerCase()
        .includes(q)
    )
    .sort((a, b) => {
      if (!q) return 0
      const ca = (a.codigo ?? '').toLowerCase()
      const cb = (b.codigo ?? '').toLowerCase()
      const score = (c: string) => (c === q ? 0 : c.startsWith(q) ? 1 : 2)
      const sa = score(ca)
      const sb = score(cb)
      if (sa !== sb) return sa - sb
      return (a.apellido ?? '').localeCompare(b.apellido ?? '')
    })

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicio = (paginaSegura - 1) * tamanoPagina
  const fin = inicio + tamanoPagina
  const paginados = filtrados.slice(inicio, fin)

  useEffect(() => {
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas)
  }, [paginaActual, totalPaginas])

  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda])

  const abrirNuevo = () => {
    if (!canManageAgricultores) return
    setEditando(null)
    setEditandoId(null)
    setDialogError(null)
    setDialogLoading(false)
    setDialogOpen(true)
  }

  const abrirEditar = async (a: Agricultor) => {
    if (!canManageAgricultores) return
    setDialogOpen(true)
    setEditando(null)
    setEditandoId(a.id)
    setDialogError(null)
    setDialogLoading(true)

    try {
      const detalle = await getAgricultor(a.id)
      setEditando(detalle)
    } catch (e) {
      setDialogError((e as Error).message)
    } finally {
      setDialogLoading(false)
    }
  }

  const cerrar = () => {
    setDialogOpen(false)
    setEditando(null)
    setEditandoId(null)
    setDialogError(null)
    setDialogLoading(false)
  }

  const handleSubmit = async (data: AgricultorFormData) => {
    try {
      if (editandoId) await actualizar(editandoId, data)
      else await crear(data)
      cerrar()
    } catch (e) {
      setDialogError((e as Error).message)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!canManageAgricultores) return
    await eliminar(id)
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Agricultores"
        actions={canManageAgricultores ? (
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        ) : undefined}
      />

      {/* Búsqueda */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código o DNI..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPaginaActual(1)
            }}
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Select
            value={String(tamanoPagina)}
            onValueChange={(value) => {
              setTamanoPagina(Number(value))
              setPaginaActual(1)
            }}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Tamano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 / pag</SelectItem>
              <SelectItem value="12">12 / pag</SelectItem>
              <SelectItem value="24">24 / pag</SelectItem>
              <SelectItem value="48">48 / pag</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant={vista === 'lista' ? 'secondary' : 'outline'}
            onClick={() => setVista('lista')}
          >
            <List className="h-4 w-4" /> Lista
          </Button>
          <Button
            type="button"
            size="sm"
            variant={vista === 'cards' ? 'secondary' : 'outline'}
            onClick={() => setVista('cards')}
          >
            <LayoutGrid className="h-4 w-4" /> Tarjetas
          </Button>
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <EmptyState
          title={busqueda ? 'Sin resultados' : 'No hay agricultores registrados'}
          description={busqueda ? 'Prueba con otro término de búsqueda.' : 'Agrega el primer agricultor.'}
          action={!busqueda && canManageAgricultores ? <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Agregar agricultor</Button> : undefined}
        />
      ) : vista === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginados.map((a) => (
            <div key={a.id} className="bg-card border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.apellido}, {a.nombre}</p>
                  <p className="text-xs text-muted-foreground">{a.codigo}{a.dni ? ` · DNI: ${a.dni}` : ''}</p>
                </div>
                <EstadoActivoBadge estado={a.estado} />
              </div>

              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {a.telefono && (
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{a.telefono}</span>
                )}
                {a.numero_cuenta && (
                  <span>N° cuenta: {formatearNumeroCuentaVisible(a.numero_cuenta, canManageAgricultores)}</span>
                )}
                {a.ubicacion && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{a.ubicacion}</span>
                )}
              </div>

              {canManageAgricultores && (
                <div className="flex gap-2 pt-1 border-t">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => abrirEditar(a)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setAEliminar(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Código</TableHead>
                <TableHead>Agricultor</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>N° cuenta</TableHead>
                <TableHead>Fecha alta</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                {canManageAgricultores && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.codigo}</TableCell>
                  <TableCell>
                    <p className="font-medium">{a.apellido}, {a.nombre}</p>
                  </TableCell>
                  <TableCell>{a.dni || '—'}</TableCell>
                  <TableCell>{a.telefono || '—'}</TableCell>
                  <TableCell>{a.numero_cuenta ? formatearNumeroCuentaVisible(a.numero_cuenta, canManageAgricultores) : '—'}</TableCell>
                  <TableCell>{a.fecha_alta || '—'}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{a.ubicacion || '—'}</TableCell>
                  <TableCell>
                    <EstadoActivoBadge estado={a.estado} />
                  </TableCell>
                  {canManageAgricultores && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setAEliminar(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {inicio + 1}-{Math.min(fin, filtrados.length)} de {filtrados.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaSegura === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {paginaSegura} de {totalPaginas}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Dialog formulario */}
      {canManageAgricultores && (
        <ConfirmDialog
          open={!!aEliminar}
          title="¿Eliminar agricultor?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => { handleEliminar(aEliminar!); setAEliminar(null) }}
          onCancel={() => setAEliminar(null)}
        />
      )}

      {canManageAgricultores && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editandoId ? 'Editar agricultor' : 'Nuevo agricultor'}</DialogTitle>
            </DialogHeader>
            {dialogLoading ? (
              <div className="flex min-h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : dialogError ? (
              <ErrorMessage message={dialogError} onRetry={editandoId ? () => {
                const current = agricultores.find((a) => a.id === editandoId)
                if (current) void abrirEditar(current)
              } : undefined} />
            ) : (
              <AgricultorForm
                defaultValues={editando ?? undefined}
                onSubmit={handleSubmit}
                onCancel={cerrar}
                isEditing={!!editandoId}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function formatearNumeroCuentaVisible(numeroCuenta: string, puedeGestionar: boolean): string {
  if (puedeGestionar) return numeroCuenta

  const limpio = numeroCuenta.replace(/\s+/g, '')
  if (limpio.length <= 4) return limpio

  return `${'*'.repeat(limpio.length - 4)}${limpio.slice(-4)}`
}
