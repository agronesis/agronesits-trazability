import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { generateTareoDiarioExcel } from '@/utils/tareo-excel'
import { getTareoDiario, type TareoDiarioRow } from '@/services/tareo.service'

export default function TareoDiarioPage() {
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [rows, setRows] = useState<TareoDiarioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalKilos = useMemo(
    () => rows.reduce((acc, row) => acc + row.kilos, 0),
    [rows]
  )

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTareoDiario(fecha)
      setRows(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tareo Diario"
        description="Descarga por fecha el resumen de kilos por colaborador (DNI, rol y kilos)."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => generateTareoDiarioExcel(fecha, rows)}
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Descargar Excel
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium mb-1">Fecha</p>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full sm:w-[220px]" />
            </div>
            <Button type="button" loading={loading} onClick={cargar}>Consultar</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Validación aplicada: recepción usa kg brutos de lotes; selección usa kg exportables (kg cat1 + kg cat2).
          </p>
        </CardContent>
      </Card>

      {error && <ErrorMessage message={error} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado del día</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>DNI</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Kilos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {loading ? 'Consultando...' : 'Sin datos para la fecha seleccionada.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.colaborador_id}-${row.rol}`}>
                    <TableCell>{row.dni ?? '-'}</TableCell>
                    <TableCell className="font-medium">{row.apellido}, {row.nombre}</TableCell>
                    <TableCell>{normalizarRol(row.rol)}</TableCell>
                    <TableCell className="text-right">{row.kilos.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t text-right text-sm font-medium">
            Total kilos: {totalKilos.toFixed(2)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function normalizarRol(rol: string): string {
  if (rol === 'recepcionista') return 'Recepcionista'
  if (rol === 'seleccionador') return 'Seleccionador'
  if (rol === 'empaquetador') return 'Empaquetador'
  return rol
}
