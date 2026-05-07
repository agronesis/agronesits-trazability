import { Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onOpenMobileSidebar: () => void
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const { user } = useAuthStore()
  const { toggleSidebar } = useUIStore()

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'AG'

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 shrink-0">
      {/* Botón hamburguesa (mobile) */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileSidebar}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Botón colapsar (desktop) – usa el store */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={toggleSidebar}
        aria-label="Colapsar menú"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
          {initials}
        </div>
      </div>
    </header>
  )
}
