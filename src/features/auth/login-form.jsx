import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './auth-context'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from 'sonner'

export function LoginForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            await signIn(email, password)
            toast.success('Bienvenido a Gourmet Click')
            navigate('/dashboard')
        } catch (error) {
            toast.error(error.message || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Bienvenido de nuevo</h2>
                <p className="text-muted-foreground">Ingresa tus credenciales para acceder al panel.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground">Correo Electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@gourmetclick.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-background border-input h-12 rounded-xl focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-foreground">Contraseña</Label>
                            <a href="#" className="text-sm font-medium text-primary hover:underline">
                                ¿Olvidaste tu contraseña?
                            </a>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                    {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
                </Button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        O continúa con
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
                    ¿Aún no tienes cuenta?{' '}
                    <Link to="/register" className="text-primary hover:underline font-medium ml-1">
                        Solicitar acceso
                    </Link>
                </p>
            </div>
        </div>
    )
}
