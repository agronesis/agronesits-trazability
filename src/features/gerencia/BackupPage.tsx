import { useState } from 'react'
import { Database, Download, FileArchive, FileSpreadsheet, ShieldAlert } from 'lucide-react'
import {
  descargarTodasLasTablas,
  TABLAS_BACKUP,
  type ProgresoBackup,
  type TablaRespaldada,
} from '@/services/backup.service'
import { generateBackupExcel } from '@/utils/backup-excel'
import { generateBackupZip } from '@/utils/backup-csv'
import { PageHeader } from '@/components/shared/PageHeader'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Formato = 'zip' | 'excel'

export default function BackupPage() {
  const [descargando, setDescargando] = useState<Formato | null>(null)
  const [progreso, setProgreso] = useState<ProgresoBackup | null>(null)
  const [resultado, setResultado] = useState<{ archivo: string; tablas: TablaRespaldada[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDescargar = async (formato: Formato) => {
    if (descargando) return

    setDescargando(formato)
    setError(null)
    setResultado(null)
    setProgreso(null)

    try {
      const tablas = await descargarTodasLasTablas(setProgreso)
      const archivo = formato === 'zip' ? generateBackupZip(tablas) : generateBackupExcel(tablas)
      setResultado({ archivo, tablas })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDescargando(null)
      setProgreso(null)
    }
  }

  const totalRegistros = resultado?.tablas.reduce((acc, t) => acc + t.filas.length, 0) ?? 0
  const porcentaje = progreso ? Math.round((progreso.indice / progreso.total) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Respaldo de la información"
        description={`Descarga el contenido completo del sistema: las ${TABLAS_BACKUP.length} tablas en un solo archivo.`}
      />

      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="rounded-full bg-agro-green-light/10 p-4">
              <Database className="h-8 w-8 text-agro-green-light" />
            </div>

            <div className="max-w-md">
              <p className="text-sm text-muted-foreground">
                Se descargan agricultores, colaboradores, lotes, clasificaciones, despachos,
                liquidaciones y planillas, con todos sus registros. Puede tardar un minuto.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                onClick={() => handleDescargar('zip')}
                disabled={descargando !== null}
                className="gap-2"
              >
                <FileArchive className="h-5 w-5" />
                {descargando === 'zip' ? 'Descargando…' : 'Descargar respaldo'}
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => handleDescargar('excel')}
                disabled={descargando !== null}
                className="gap-2"
              >
                <FileSpreadsheet className="h-5 w-5" />
                {descargando === 'excel' ? 'Descargando…' : 'Ver en Excel'}
              </Button>
            </div>

            {progreso && (
              <div className="w-full max-w-md">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-agro-green-light transition-all duration-300"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Leyendo {progreso.tabla} ({progreso.filas} registros) · {progreso.indice} de {progreso.total}
                </p>
              </div>
            )}

            {resultado && (
              <div className="w-full max-w-md rounded-md border border-green-200 bg-green-50 p-4 text-left">
                <p className="flex items-center gap-2 text-sm font-medium text-green-900">
                  <Download className="h-4 w-4" />
                  {resultado.archivo}
                </p>
                <p className="mt-1 text-xs text-green-800">
                  {totalRegistros.toLocaleString('es-PE')} registros de {resultado.tablas.length} tablas.
                </p>
              </div>
            )}

            {error && <ErrorMessage message={error} onRetry={() => handleDescargar('zip')} />}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-700" />
        <div className="text-sm text-amber-900">
          <p className="font-medium">El archivo contiene datos personales</p>
          <p className="mt-1 text-amber-800">
            Incluye los DNI y los números de cuenta de todo el padrón. Guárdalo en un lugar
            seguro y no lo compartas por correo ni por WhatsApp.
          </p>
          <p className="mt-2 text-amber-800">
            El respaldo es un ZIP con un CSV por tabla, que es lo que Supabase sabe volver a
            importar. El Excel es solo para mirar la información, no sirve para restaurarla.
          </p>
        </div>
      </div>
    </div>
  )
}
