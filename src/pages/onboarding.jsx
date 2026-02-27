import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { toast } from 'sonner'
import { UtensilsCrossed, ArrowRight, Building2 } from 'lucide-react'

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .slice(0, 50)
}

export function OnboardingPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name.trim()) {
            toast.error('Ingresa el nombre de tu restaurante')
            return
        }

        setLoading(true)
        try {
            const baseSlug = slugify(name)
            // Make slug unique by appending a short random suffix
            const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

            const { error } = await supabase
                .from('restaurants')
                .insert({
                    name: name.trim(),
                    owner_id: user.id,
                    slug,
                    plan: 'free',
                })

            if (error) throw error

            toast.success('¡Restaurante configurado! Bienvenido a Gourmet Click 🎉')
            // Force a full navigation so TenantProvider re-fetches
            window.location.href = '/dashboard'
        } catch (err) {
            console.error('Onboarding error:', err)
            toast.error(err.message || 'Error al crear el restaurante')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-primary to-primary/60 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20 mb-5">
                        <UtensilsCrossed className="w-9 h-9 text-primary-foreground" />
                    </div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">
                        Configura tu restaurante
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm font-medium">
                        Solo tarda 30 segundos. Puedes editar todo después.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border/60 rounded-3xl p-8 shadow-sm">
                    <div className="space-y-2">
                        <Label htmlFor="restaurantName" className="text-sm font-bold flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            Nombre del negocio
                        </Label>
                        <Input
                            id="restaurantName"
                            type="text"
                            placeholder="Ej. Tacos El Güero, Café 5ta Avenida..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                            className="h-14 text-base rounded-2xl bg-muted/30 border-border/60 focus:ring-primary/20 font-medium"
                            maxLength={80}
                        />
                        {name && (
                            <p className="text-xs text-muted-foreground pl-1">
                                Tu menú público estará en:{' '}
                                <span className="font-mono text-primary font-bold">
                                    /menu/{slugify(name) || '...'}
                                </span>
                            </p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? (
                            'Configurando...'
                        ) : (
                            <>
                                Empezar a usar Gourmet Click
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </Button>
                </form>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    Sesión activa como <span className="font-bold text-foreground">{user?.email}</span>
                </p>
            </div>
        </div>
    )
}
