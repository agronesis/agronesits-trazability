import { ChevronDown, Package2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import type { PalletDisponibleDespacho } from '@/services/despachos.service'

interface PalletMultiSelectProps {
  options: PalletDisponibleDespacho[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  disabled?: boolean
}

export function PalletMultiSelect({ options, selectedKeys, onChange, disabled }: PalletMultiSelectProps) {
  const selectedOptions = options.filter((item) => selectedKeys.includes(item.key))

  const toggleKey = (key: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedKeys, key])
      return
    }
    onChange(selectedKeys.filter((item) => item !== key))
  }

  const selectedCount = selectedKeys.length
  const summary = selectedCount === 0
    ? 'Seleccionar pallets'
    : `${selectedCount} pallet${selectedCount > 1 ? 's' : ''} seleccionado${selectedCount > 1 ? 's' : ''}`

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between" disabled={disabled}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            {options.length} pallet{options.length !== 1 ? 's' : ''} disponible{options.length !== 1 ? 's' : ''}
          </div>
          <div className="max-h-80 overflow-auto p-2 space-y-1">
              {options.map((option) => {
                const checked = selectedKeys.includes(option.key)
                return (
                  <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/30">
                    <Checkbox checked={checked} onCheckedChange={(value) => toggleKey(option.key, value === true)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Package2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Pallet {option.numero_pallet}</span>
                        <span className="text-xs text-muted-foreground">{option.num_cajas} cajas</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {option.lote_codigo} · {VARIEDAD_PRODUCTO_CONFIG[option.variedad].label} · {option.producto_nombre}
                      </p>
                    </div>
                  </label>
                )
              })}
              {options.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No hay pallets disponibles para despachar.</p>
              )}
            </div>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge key={option.key} variant="info" className="gap-1 pr-1">
              <span>Pallet {option.numero_pallet}</span>
              <span className="opacity-70">{option.lote_codigo}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10"
                onClick={() => toggleKey(option.key, false)}
                aria-label={`Quitar pallet ${option.numero_pallet}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}