import { useState, useMemo } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { Acopiador, Agricultor } from '@/types/models'

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

interface AcopiadorPickerProps {
  value: string
  onChange: (value: string) => void
  acopiadores: Acopiador[]
  agricultores: Agricultor[]
  error?: boolean
}

export function AcopiadorPicker({ value, onChange, acopiadores, agricultores, error }: AcopiadorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'agricultores' | 'acopiadores'>('agricultores')

  const label = useMemo(() => {
    if (!value) return null
    const colonIdx = value.indexOf(':')
    const type = value.slice(0, colonIdx)
    const id = value.slice(colonIdx + 1)
    if (type === 'aco') {
      const a = acopiadores.find((x) => x.id === id)
      return a ? `${a.apellido}, ${a.nombre} (${a.codigo}) · Acopiador` : null
    }
    if (type === 'agri') {
      const a = agricultores.find((x) => x.id === id)
      return a ? `${a.apellido}, ${a.nombre} (${a.codigo}) · Agricultor` : null
    }
    return null
  }, [value, acopiadores, agricultores])

  const q = normalizeSearchText(search)

  const filteredAcopiadores = useMemo(
    () => acopiadores.filter((a) => normalizeSearchText(`${a.apellido} ${a.nombre} ${a.codigo}`).includes(q)),
    [acopiadores, q]
  )

  const filteredAgricultores = useMemo(
    () => agricultores.filter((a) => normalizeSearchText(`${a.apellido} ${a.nombre} ${a.codigo}`).includes(q)),
    [agricultores, q]
  )

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) return

    if (value.startsWith('aco:')) {
      setActiveTab('acopiadores')
      return
    }

    setActiveTab('agricultores')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            error ? 'border-destructive' : 'border-input',
            !label && 'text-muted-foreground'
          )}
        >
          <span className="line-clamp-1 text-left">{label ?? 'Ninguno'}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Buscador */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <div className="border-b p-1">
          <button
            type="button"
            onClick={() => handleSelect('')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Check className={cn('h-4 w-4 shrink-0', value === '' ? 'opacity-100' : 'opacity-0')} />
            <span className="truncate flex-1 text-left">Ninguno</span>
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as 'agricultores' | 'acopiadores')}>
          <div className="p-2 pb-1">
            <TabsList>
              <TabsTrigger value="agricultores">Agricultores</TabsTrigger>
              <TabsTrigger value="acopiadores">Acopiadores</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="agricultores">
            <ul className="max-h-64 overflow-y-auto p-1">
              {filteredAgricultores.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
              ) : (
                filteredAgricultores.map((a) => {
                  const val = `agri:${a.id}`
                  return (
                    <li key={val}>
                      <button
                        type="button"
                        onClick={() => handleSelect(val)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <Check className={cn('h-4 w-4 shrink-0', value === val ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate flex-1 text-left">{a.apellido}, {a.nombre} ({a.codigo})</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </TabsContent>

          <TabsContent value="acopiadores">
            <ul className="max-h-64 overflow-y-auto p-1">
              {filteredAcopiadores.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
              ) : (
                filteredAcopiadores.map((a) => {
                  const val = `aco:${a.id}`
                  return (
                    <li key={val}>
                      <button
                        type="button"
                        onClick={() => handleSelect(val)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <Check className={cn('h-4 w-4 shrink-0', value === val ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate flex-1 text-left">{a.apellido}, {a.nombre} ({a.codigo})</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
