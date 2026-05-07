import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type ModalidadPago = 'transferencia' | 'yape_plin' | 'efectivo'

export interface RegistroPagoPayload {
  fecha_pago: string
  numero_operacion: string
  modalidad_pago: ModalidadPago
}

interface RegistrarPagoDialogProps {
  open: boolean
  loading?: boolean
  title?: string
  description?: string
  onCancel: () => void
  onConfirm: (payload: RegistroPagoPayload) => void | Promise<void>
}

function getTodayIsoLocal(): string {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function RegistrarPagoDialog({
  open,
  loading,
  title = 'Registrar pago',
  description = 'Completa los datos del pago para continuar.',
  onCancel,
  onConfirm,
}: RegistrarPagoDialogProps) {
  const [fechaPago, setFechaPago] = useState('')
  const [numeroOperacion, setNumeroOperacion] = useState('')
  const [modalidadPago, setModalidadPago] = useState<ModalidadPago | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFechaPago(getTodayIsoLocal())
      setNumeroOperacion('')
      setModalidadPago('')
      setError(null)
    }
  }, [open])

  const handleConfirm = async () => {
    if (!fechaPago || !numeroOperacion.trim() || !modalidadPago) {
      setError('Completa fecha de pago, numero de operacion y modalidad.')
      return
    }

    setError(null)
    await onConfirm({
      fecha_pago: fechaPago,
      numero_operacion: numeroOperacion.trim(),
      modalidad_pago: modalidadPago,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !loading) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fecha-pago">Fecha de pago</Label>
            <Input
              id="fecha-pago"
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="numero-operacion">Numero de operacion</Label>
            <Input
              id="numero-operacion"
              placeholder="Ej. OP-12345"
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Modalidad</Label>
            <Select
              value={modalidadPago}
              onValueChange={(value) => setModalidadPago(value as ModalidadPago)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona modalidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="yape_plin">Yape/Plin</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => { void handleConfirm() }} disabled={loading}>
            {loading ? 'Guardando...' : 'Confirmar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
