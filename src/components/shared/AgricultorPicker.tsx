import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Agricultor } from '@/types/models'

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

interface AgricultorPickerProps {
  value: string
  onChange: (value: string) => void
  agricultores: Agricultor[]
  placeholder?: string
  error?: boolean
}

export function AgricultorPicker({
  value,
  onChange,
  agricultores,
  placeholder = 'Seleccionar agricultor...',
  error,
}: AgricultorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const seleccionado = useMemo(
    () => agricultores.find((agricultor) => agricultor.id === value) ?? null,
    [agricultores, value]
  )

  const filteredAgricultores = useMemo(() => {
    const q = normalizeSearchText(search)
    if (!q) return agricultores

    return agricultores.filter((agricultor) => (
      normalizeSearchText(`${agricultor.apellido} ${agricultor.nombre} ${agricultor.codigo} ${agricultor.dni ?? ''}`)
        .includes(q)
    ))
  }, [agricultores, search])

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setSearch('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearch('')
    }
  }

  const label = seleccionado
    ? `${seleccionado.apellido}, ${seleccionado.nombre} (${seleccionado.codigo})`
    : placeholder

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            error ? 'border-destructive' : 'border-input',
            !seleccionado && 'text-muted-foreground'
          )}
        >
          <span className="line-clamp-1 text-left">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <ul className="max-h-64 overflow-y-auto p-1">
          {filteredAgricultores.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
          ) : (
            filteredAgricultores.map((agricultor) => (
              <li key={agricultor.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(agricultor.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Check className={cn('h-4 w-4 shrink-0', value === agricultor.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate flex-1 text-left">{agricultor.apellido}, {agricultor.nombre} ({agricultor.codigo})</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}