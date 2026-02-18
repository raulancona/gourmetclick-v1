import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './auth-context'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from 'sonner'

export function RegisterForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const { signUp } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden')
            return
        }

        if (password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres')
            return
        }

        setLoading(true)

        try {
            await signUp(email, password)
            toast.success('Cuenta creada exitosamente')
            navigate('/dashboard')
        } catch (error) {
            toast.error(error.message || 'Error al crear la cuenta')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Crear Cuenta</h2>
                <p className="text-muted-foreground">Regístrate para comenzar a gestionar tu negocio.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground">Correo Electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-background border-input h-12 rounded-xl focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-foreground">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-background border-input h-12 rounded-xl focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-foreground">Confirmar Contraseña</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="bg-background border-input h-12 rounded-xl focus:ring-primary/20"
                        />
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                    disabled={loading}
                >
                    {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        O regístrate con
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-11 rounded-xl border-input hover:bg-muted" disabled>
                    Google
                </Button>
                <Button variant="outline" className="h-11 rounded-xl border-input hover:bg-muted" disabled>
                    Apple
                </Button>
            </div>

            <div className="text-center">
                <p className="text-sm text-muted-foreground">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium ml-1">
                        Inicia sesión aquí
                    </Link>
                </p>
            </div>
        </div>
    )
}
