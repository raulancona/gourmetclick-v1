import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './auth-context'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card'
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
            toast.success('Sesión iniciada correctamente')
            navigate('/dashboard')
        } catch (error) {
            toast.error(error.message || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Iniciar Sesión</CardTitle>
                <CardDescription>
                    Ingresa tus credenciales para acceder a tu cuenta
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </Button>
                    <p className="text-sm text-muted-foreground text-center">
                        ¿No tienes cuenta?{' '}
                        <Link to="/register" className="text-primary hover:underline">
                            Regístrate aquí
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    )
}
