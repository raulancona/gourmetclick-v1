import { useState, useEffect } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { getLinkCard, upsertLinkCard } from '../lib/link-card-service'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Plus, Trash2, GripVertical, ExternalLink, Palette, Layout, Save, Loader2, Globe, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { motion, Reorder } from 'framer-motion'

const THEMES = [
    { name: 'Dark Night', background: 'linear-gradient(to bottom, #1a1a1a, #000000)', textColor: '#ffffff', cardColor: 'rgba(255,255,255,0.1)' },
    { name: 'Ocean Blue', background: 'linear-gradient(to bottom, #1e3a8a, #1e40af)', textColor: '#ffffff', cardColor: 'rgba(255,255,255,0.15)' },
    { name: 'Sunset Rose', background: 'linear-gradient(to bottom, #881337, #4c0519)', textColor: '#ffffff', cardColor: 'rgba(255,255,255,0.1)' },
    { name: 'Forest Green', background: 'linear-gradient(to bottom, #064e3b, #065f46)', textColor: '#ffffff', cardColor: 'rgba(255,255,255,0.1)' },
    { name: 'Minimal White', background: '#f8fafc', textColor: '#0f172a', cardColor: 'rgba(255,255,255,1)', borderColor: '#e2e8f0' }
]

export function LinkCardConfigPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState({
        title: '',
        bio: '',
        slug: '',
        restaurant_logo_url: '',
        theme: THEMES[0],
        links: []
    })

    useEffect(() => {
        if (user) loadConfig()
    }, [user])

    const loadConfig = async () => {
        try {
            setLoading(true)
            const data = await getLinkCard(user.id)
            if (data) {
                setConfig({
                    ...data,
                    links: data.links || [],
                    theme: data.theme || THEMES[0]
                })
            } else {
                // Default slug from username or restaurant name if possible
                setConfig(prev => ({ ...prev, slug: user.email.split('@')[0] }))
            }
        } catch (error) {
            console.error('Error loading LinkCard:', error)
            toast.error('Error al cargar la configuración')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!config.slug) {
            toast.error('La URL personalizada (slug) es obligatoria')
            return
        }
        try {
            setSaving(true)
            await upsertLinkCard(user.id, config)
            toast.success('Configuración guardada correctamente')
        } catch (error) {
            console.error('Error saving LinkCard:', error)
            toast.error('Error al guardar: ' + (error.message || 'Intenta con otro slug'))
        } finally {
            setSaving(false)
        }
    }

    const addLink = () => {
        setConfig(prev => ({
            ...prev,
            links: [...prev.links, { id: crypto.randomUUID(), title: '', url: '', enabled: true }]
        }))
    }

    const removeLink = (id) => {
        setConfig(prev => ({
            ...prev,
            links: prev.links.filter(l => l.id !== id)
        }))
    }

    const updateLink = (id, updates) => {
        setConfig(prev => ({
            ...prev,
            links: prev.links.map(l => l.id === id ? { ...l, ...updates } : l)
        }))
    }

    if (loading) {
        return <div className="p-8 h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 lg:p-8 max-w-6xl mx-auto h-full flex flex-col gap-8 overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground">LinkCard Configurator</h1>
                    <p className="text-muted-foreground">Personaliza tu perfil de enlaces para redes sociales</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => window.open(`/l/${config.slug}`, '_blank')} disabled={!config.id}>
                        <Globe className="w-4 h-4 mr-2" />
                        Ver Público
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar Cambios
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Editor Side */}
                <div className="space-y-6">
                    {/* Basic Info */}
                    <Card className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Layout className="w-5 h-5 text-primary" /> Perfil Principal
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">Título / Nombre</label>
                                    <Input
                                        value={config.title}
                                        onChange={e => setConfig({ ...config, title: e.target.value })}
                                        placeholder="Ej: Gourmet House"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">URL Personalizada</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-sm">/l/</span>
                                        <Input
                                            value={config.slug}
                                            onChange={e => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                            placeholder="mi-restaurante"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold">Biografía / Descripción</label>
                                <Textarea
                                    value={config.bio}
                                    onChange={e => setConfig({ ...config, bio: e.target.value })}
                                    placeholder="Cuéntale a tus clientes sobre tu negocio..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold">URL Logo (Opcional)</label>
                                <Input
                                    value={config.restaurant_logo_url}
                                    onChange={e => setConfig({ ...config, restaurant_logo_url: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Theme Selector */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Palette className="w-5 h-5 text-primary" /> Diseño y Colores
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {THEMES.map(theme => (
                                    <button
                                        key={theme.name}
                                        onClick={() => setConfig({ ...config, theme })}
                                        className={`p-3 rounded-xl border-2 transition-all flex flex-col gap-2 ${config.theme.name === theme.name ? 'border-primary ring-2 ring-primary/10' : 'border-border hover:border-primary/40'}`}
                                    >
                                        <div className="h-10 w-full rounded-md" style={{ background: theme.background }}></div>
                                        <span className="text-xs font-bold text-center">{theme.name}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Links Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-foreground">Mis Enlaces</h2>
                            <Button size="sm" onClick={addLink} className="rounded-full">
                                <Plus className="w-4 h-4 mr-2" /> Agregar Enlace
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {config.links.map((link, idx) => (
                                <Card key={link.id} className="border-border/50 shadow-sm">
                                    <CardContent className="p-4 flex gap-4 items-center">
                                        <div className="cursor-grab text-muted-foreground"><GripVertical className="w-5 h-5" /></div>
                                        <div className="flex-1 grid md:grid-cols-2 gap-3">
                                            <Input
                                                value={link.title}
                                                onChange={e => updateLink(link.id, { title: e.target.value })}
                                                placeholder="Título del enlace (Ej: Reservaciones)"
                                                className="h-9"
                                            />
                                            <Input
                                                value={link.url}
                                                onChange={e => updateLink(link.id, { url: e.target.value })}
                                                placeholder="https://wa.me/..."
                                                className="h-9"
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeLink(link.id)} className="text-destructive hover:bg-destructive/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {config.links.length === 0 && (
                                <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                                    No has agregado enlaces aún.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Side */}
                <div className="sticky top-8 flex justify-center">
                    <div className="relative w-[320px] h-[640px] border-[8px] border-zinc-800 rounded-[3rem] shadow-2xl overflow-hidden bg-white">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-2xl z-20"></div>

                        {/* Live Preview Content */}
                        <div className="w-full h-full overflow-y-auto no-scrollbar pb-8" style={{ background: config.theme.background, color: config.theme.textColor }}>
                            <div className="p-8 pt-16 flex flex-col items-center text-center">
                                {config.restaurant_logo_url ? (
                                    <img src={config.restaurant_logo_url} className="w-24 h-24 rounded-full border-4 border-white/20 shadow-lg mb-4" alt="logo" />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-4"><Palette className="w-10 h-10 opacity-50" /></div>
                                )}
                                <h3 className="text-xl font-black mb-1">{config.title || 'Mi Restaurante'}</h3>
                                <p className="text-sm opacity-80 mb-8 max-w-[240px]">{config.bio || 'Bienvenido a nuestra selección de enlaces.'}</p>

                                <div className="w-full space-y-4">
                                    {(config.links.length > 0 ? config.links : [{ id: 1, title: 'Menú Digital', url: '#' }]).map((link, i) => (
                                        <div
                                            key={link.id || i}
                                            className="w-full p-4 rounded-xl font-bold shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
                                            style={{
                                                background: config.theme.cardColor,
                                                border: config.theme.borderColor ? `1px solid ${config.theme.borderColor}` : '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            {link.title || 'Nuevo Enlace'}
                                            <ExternalLink className="w-4 h-4 opacity-50" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
