import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Phone, MapPin, LayoutGrid, List } from 'lucide-react'
import { useAcopiadores } from './hooks/useAcopiadores'
import { AcopiadorForm } from './AcopiadorForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoActivoBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Acopiador } from '@/types/models'
import type { AcopiadorFormData } from '@/utils/validators'

export default function AcopiadoresPage() {
  const { acopiadores, loading, error, reload, crear, actualizar, eliminar } = useAcopiadores()
  const [busqueda, setBusqueda] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Acopiador | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [vista, setVista] = useState<'cards' | 'lista'>('lista')
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(12)
  const [aEliminar, setAEliminar] = useState<string | null>(null)

  const filtrados = acopiadores.filter((a) =>
    `${a.nombre} ${a.apellido} ${a.codigo} ${a.dni ?? ''} ${a.telefono ?? ''} ${a.numero_cuenta ?? ''} ${a.ubicacion ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicio = (paginaSegura - 1) * tamanoPagina
  const fin = inicio + tamanoPagina
  const paginados = filtrados.slice(inicio, fin)

  useEffect(() => {
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas)
  }, [paginaActual, totalPaginas])

  const abrirNuevo = () => { setEditando(null); setDialogError(null); setDialogOpen(true) }
  const abrirEditar = (a: Acopiador) => { setEditando(a); setDialogError(null); setDialogOpen(true) }
  const cerrar = () => { setDialogOpen(false); setEditando(null); setDialogError(null) }

  const handleSubmit = async (data: AcopiadorFormData) => {
    try {
      if (editando) await actualizar(editando.id, data)
      else await crear(data)
      cerrar()
    } catch (e) {
      setDialogError((e as Error).message)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Acopiadores"
        description={`${acopiadores.length} registrados`}
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
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

      {filtrados.length === 0 ? (
        <EmptyState title="Sin acopiadores" action={!busqueda ? <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Agregar</Button> : undefined} />
      ) : vista === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginados.map((a) => (
            <div key={a.id} className="bg-card border rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{a.apellido}, {a.nombre}</p>
                  <p className="text-xs text-muted-foreground">{a.codigo}</p>
                </div>
                <EstadoActivoBadge estado={a.estado} />
              </div>
              <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
                {a.dni && <span>DNI: {a.dni}</span>}
                {a.telefono && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{a.telefono}</span>}
                {a.numero_cuenta && <span>N° cuenta: {a.numero_cuenta}</span>}
                {a.ubicacion && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{a.ubicacion}</span>}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => abrirEditar(a)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setAEliminar(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Acopiador</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>N° cuenta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.apellido}, {a.nombre}</p>
                    <p className="text-xs text-muted-foreground">{a.codigo}</p>
                  </TableCell>
                  <TableCell>{a.dni || '—'}</TableCell>
                  <TableCell>{a.telefono || '—'}</TableCell>
                  <TableCell>{a.numero_cuenta || '—'}</TableCell>
                  <TableCell><EstadoActivoBadge estado={a.estado} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(a)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setAEliminar(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
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

      <ConfirmDialog
        open={!!aEliminar}
        title="¿Eliminar acopiador?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => { eliminar(aEliminar!); setAEliminar(null) }}
        onCancel={() => setAEliminar(null)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editando ? 'Editar acopiador' : 'Nuevo acopiador'}</DialogTitle></DialogHeader>
          {dialogError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{dialogError}</p>}
          <AcopiadorForm defaultValues={editando ?? undefined} onSubmit={handleSubmit} onCancel={cerrar} isEditing={!!editando} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
