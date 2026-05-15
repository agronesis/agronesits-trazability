import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Package, Warehouse,
  Layers, Receipt, Truck, Settings,
  LogOut, ChevronLeft, Leaf, X, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { ROUTES, ENABLED_MODULES } from '@/constants'
import { Button } from '@/components/ui/button'
import { canAccessRoute } from '@/lib/permissions'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  group?: string
  featureKey?: keyof typeof ENABLED_MODULES
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',          href: ROUTES.DASHBOARD,             icon: LayoutDashboard },
  // Maestros
  { label: 'Agricultores',       href: ROUTES.AGRICULTORES,          icon: Users,         group: 'Maestros' },
  { label: 'Acopiadores',        href: ROUTES.ACOPIADORES,           icon: Users,         group: 'Maestros' },
  { label: 'Colaboradores',      href: ROUTES.COLABORADORES,         icon: Users,         group: 'Maestros' },
  { label: 'Productos',          href: ROUTES.PRODUCTOS,             icon: Package,       group: 'Maestros' },
  { label: 'Centros de Acopio',  href: ROUTES.CENTROS_ACOPIO,        icon: Warehouse,     group: 'Maestros' },
  // Operaciones
  { label: 'Lotes',              href: ROUTES.LOTES,                 icon: Layers,        group: 'Operaciones' },
  { label: 'Empaquetado',        href: ROUTES.EMPAQUETADO_OPERACIONES, icon: Package,     group: 'Operaciones' },
  { label: 'Despachos',          href: ROUTES.DESPACHOS,             icon: Truck,         group: 'Operaciones' },
  { label: 'Cubetas',            href: ROUTES.CUBETAS,               icon: Package,       group: 'Operaciones', featureKey: 'CUBETAS' },
  // Liquidaciones
  { label: 'Liq. Agricultores',  href: ROUTES.LIQUIDACIONES_AGRI,    icon: Receipt,       group: 'Liquidaciones' },
  { label: 'Planilla Quincenal', href: ROUTES.PLANILLAS,             icon: Receipt,       group: 'Liquidaciones' },
  { label: 'Tareo Diario',       href: ROUTES.TAREO,                 icon: Receipt,       group: 'Liquidaciones' },
  // Admin
  { label: 'Precios por Semana',  href: ROUTES.CONFIG_PRECIOS,        icon: Receipt,       group: 'Admin' },
  { label: 'Parámetros Sistema',  href: ROUTES.CONFIG_PARAMETROS,     icon: Settings,      group: 'Admin' },
  // Gerencia
  { label: 'Logs de Auditoría',   href: ROUTES.AUDIT_LOG,             icon: ClipboardList, group: 'Gerencia' },
]

// Agrupar ítems
const groups = ['', 'Maestros', 'Operaciones', 'Liquidaciones', 'Admin', 'Gerencia']

interface SidebarProps {
  onCloseMobile?: () => void
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const navigate = useNavigate()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const roles = useAuthStore((state) => state.roles)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate(ROUTES.LOGIN)
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Header del sidebar */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[hsl(var(--sidebar-border))] shrink-0">
        {sidebarOpen && (
          <div className="flex items-center gap-2 min-w-0">
            <Leaf className="h-5 w-5 shrink-0 text-agro-green-light" />
            <span className="font-bold text-sm truncate">AGRONESIS</span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setSidebarOpen(!sidebarOpen)
            onCloseMobile?.()
          }}
          className="h-8 w-8 shrink-0 ml-auto text-[hsl(var(--sidebar-foreground)/0.8)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
          aria-label={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
        >
          {onCloseMobile ? (
            <X className="h-4 w-4" />
          ) : (
            <ChevronLeft className={cn('h-4 w-4 transition-transform', !sidebarOpen && 'rotate-180')} />
          )}
        </Button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {groups.map((group) => {
          const items = (group
            ? NAV_ITEMS.filter((i) => i.group === group)
            : NAV_ITEMS.filter((i) => !i.group)
          ).filter((item) => (item.featureKey ? ENABLED_MODULES[item.featureKey] : true))
            .filter((item) => canAccessRoute(roles, item.href))

          if (items.length === 0) {
            return null
          }

          return (
            <div key={group || '__root'} className="mb-2">
              {group && sidebarOpen && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--sidebar-foreground)/0.5)] px-4 mb-1 mt-2">
                  {group}
                </p>
              )}
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-2.5 mx-1 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-medium'
                        : 'text-[hsl(var(--sidebar-foreground)/0.8)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
                      !sidebarOpen && 'justify-center px-2'
                    )
                  }
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer: cerrar sesión */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-[hsl(var(--sidebar-foreground)/0.7)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] transition-colors',
            !sidebarOpen && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {sidebarOpen && <span>Cerrar sesión</span>}
        </Button>
      </div>
    </aside>
  )
}
