import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Leaf, LockKeyhole, Mail } from 'lucide-react'

const loginSchema = z.object({
  email:    z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setErrorMsg(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) setErrorMsg('Credenciales incorrectas. Verifique su correo y contraseña.')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(255,255,255,0.65),transparent),linear-gradient(140deg,#d7dfdd_0%,#aab9b6_40%,#2f5f52_100%)] p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100vh-3rem)]">
        <Card className="w-full border-white/40 bg-white/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Leaf className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">AGRONESIS DEL PERU</CardTitle>
              <CardDescription>Trazabilidad • Holantao & Snow Peas</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  Correo electronico
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@agronesis.com"
                    autoComplete="email"
                    className="pl-9"
                    {...register('email')}
                  />
                </div>
                {errors.email?.message && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Contrasena
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-9"
                    {...register('password')}
                  />
                </div>
                {errors.password?.message && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {errorMsg && (
                <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-center text-sm text-destructive">
                  {errorMsg}
                </p>
              )}

              <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
                Ingresar
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Sistema interno — solo personal autorizado
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
