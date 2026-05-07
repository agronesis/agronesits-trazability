import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  type: ToastType
  message: string
  onClose?: () => void
}

const toastConfig = {
  success: { icon: CheckCircle2, className: 'bg-green-50 border-green-200 text-green-800' },
  error:   { icon: XCircle,      className: 'bg-red-50 border-red-200 text-red-800' },
  info:    { icon: Info,          className: 'bg-blue-50 border-blue-200 text-blue-800' },
  warning: { icon: AlertTriangle, className: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
}

export function Toast({ type, message, onClose }: ToastProps) {
  const { icon: Icon, className } = toastConfig[type]
  return (
    <div className={cn('flex items-center gap-3 border rounded-lg px-4 py-3 shadow-md animate-fade-in', className)}>
      <Icon className="h-4 w-4 shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      {onClose && (
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// HOOK SIMPLE DE TOAST (sin contexto externo)
// ─────────────────────────────────────────────
import { useState, useCallback } from 'react'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, toast, remove }
}

// ─────────────────────────────────────────────
// CONTENEDOR DE TOASTS
// ─────────────────────────────────────────────
interface ToastContainerProps {
  toasts: ToastItem[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <Toast key={t.id} type={t.type} message={t.message} onClose={() => onRemove(t.id)} />
      ))}
    </div>
  )
}
