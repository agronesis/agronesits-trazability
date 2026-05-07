import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return <Loader2 className={cn('animate-spin text-muted-foreground', sizes[size], className)} />
}

interface LoadingPageProps { message?: string }
export function LoadingPage({ message = 'Cargando...' }: LoadingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
      <Spinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
