import { useState, useEffect } from 'react'
import {
    Palette, LayoutGrid, Image as ImageIcon, Upload, Loader2, Save,
    AlignJustify, Grid3X3, LayoutList, DollarSign, FileText, Smartphone,
    ShoppingBag, Search
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'

const COLOR_PRESETS = [
    { name: 'Gourmet Red', value: '#EF4444' },
    { name: 'Luxury Orange', value: '#F97316' },
    { name: 'Golden Sun', value: '#EAB308' },
    { name: 'Fresh Green', value: '#22C55E' },
    { name: 'Ocean Blue', value: '#3B82F6' },
    { name: 'Royal Indigo', value: '#6366F1' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Midnight', value: '#1E293B' },
]

// ─── Mobile-frame Live Preview ────────────────────────────────────────────────
function MobileLivePreview({ settings }) {
    const pc = settings.primary_color || '#F97316'
    const { logo_url, banner_url, config = {} } = settings
    const showPrices = config.show_prices !== false
    const cardStyle = config.card_style || 'list'

    return (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-muted/50 rounded-full">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Vista Previa en Tiempo Real</span>
            </div>

            {/* Phone frame */}
            <div className="relative mx-auto border-[10px] border-gray-900 rounded-[3rem] h-[580px] w-[290px] overflow-hidden shadow-2xl bg-[#FAFAFA] select-none pointer-events-none">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-900 rounded-b-2xl z-50" />

                <div className="h-full overflow-y-auto no-scrollbar pb-16">
                    {/* Hero Header */}
                    <div
                        className="relative pt-6 pb-4 px-4"
                        style={{ background: `linear-gradient(135deg, ${pc}dd, ${pc})` }}
                    >
                        {banner_url && (
                            <img src={banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        {banner_url && <div className="absolute inset-0 bg-black/40" />}
                        <div className="relative z-10 flex items-center gap-2.5 mb-3">
                            <div className="w-9 h-9 rounded-xl border-2 border-white/40 overflow-hidden bg-white/20 flex items-center justify-center">
                                {logo_url
                                    ? <img src={logo_url} className="w-full h-full object-contain" alt="" />
                                    : <span className="text-white font-black text-xs">R</span>
                                }
                            </div>
                            <div>
                                <p className="text-white font-black text-xs">Tu Restaurante</p>
                                <p className="text-white/60 text-[9px]">Menú Digital</p>
                            </div>
                        </div>
                        <div className="relative z-10 bg-white rounded-xl px-2.5 py-2 flex items-center gap-2">
                            <Search className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="text-[10px] text-gray-400">¿Qué se te antoja hoy?</span>
                        </div>
                    </div>

                    {/* Category pills */}
                    <div className="flex gap-1.5 px-3 py-2.5 bg-white border-b border-gray-100 overflow-hidden">
                        {['✨ Todos', 'Tacos', 'Bebidas'].map((t, i) => (
                            <span key={t} className="px-2.5 py-1 rounded-full text-[9px] font-black whitespace-nowrap"
                                style={i === 0 ? { background: pc, color: '#fff' } : { background: 'white', color: '#9ca3af', border: '1px solid #e5e7eb' }}>
                                {t}
                            </span>
                        ))}
                    </div>

                    {/* Category section header */}
                    <div className="px-3 pt-3 pb-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full" style={{ background: pc }} />
                            <span className="text-[10px] font-black text-gray-800">Especialidades</span>
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="text-[9px] text-gray-400">3 platillos</span>
                        </div>
                    </div>

                    {/* Products */}
                    <div className={`px-3 pt-1 pb-4 ${cardStyle === 'card' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                        {[
                            { name: 'Taco al Pastor', price: 45, hasImg: true },
                            { name: 'Quesadilla Esp.', price: 85, hasImg: false },
                        ].map((p) => (
                            cardStyle === 'card' ? (
                                <div key={p.name} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                    <div className="h-20 flex items-center justify-center"
                                        style={{ background: `linear-gradient(135deg, ${pc}18, ${pc}30)` }}>
                                        <span style={{ color: pc, opacity: 0.5, fontSize: 20 }}>🍽</span>
                                    </div>
                                    <div className="p-1.5">
                                        <p className="text-[9px] font-black text-gray-900 truncate">{p.name}</p>
                                        {showPrices && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg mt-1 inline-block"
                                                style={{ color: pc, background: `${pc}15` }}>
                                                ${p.price}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div key={p.name} className="bg-white rounded-xl border border-gray-100 flex items-stretch overflow-hidden">
                                    <div className="w-14 flex-shrink-0 flex items-center justify-center"
                                        style={{ background: `linear-gradient(135deg, ${pc}18, ${pc}30)` }}>
                                        <span style={{ color: pc, opacity: 0.5, fontSize: 16 }}>🍽</span>
                                    </div>
                                    <div className="flex-1 px-2 py-1.5 flex flex-col justify-between min-w-0">
                                        <p className="text-[10px] font-black text-gray-900 truncate">{p.name}</p>
                                        {showPrices && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
                                                style={{ color: pc, background: `${pc}15` }}>
                                                ${p.price}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center pr-2">
                                        <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: pc }}>
                                            <span className="text-white text-[10px] font-black">+</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* Bottom CTA */}
                <div className="absolute bottom-0 inset-x-0 p-2 bg-white/90 backdrop-blur border-t border-gray-100">
                    <div className="w-full h-9 rounded-xl flex items-center justify-between px-3 text-white"
                        style={{ background: '#25D366' }}>
                        <div className="flex items-center gap-1.5">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-wide">Ver Pedido (2)</span>
                        </div>
                        <span className="text-[10px] font-black">$130</span>
                    </div>
                </div>
            </div>

            <p className="mt-4 text-[11px] text-muted-foreground text-center">
                Así verán tus clientes el menú en sus teléfonos
            </p>
        </div>
    )
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export function MenuAppearanceForm({ onPreviewUpdate } = {}) {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState({ logo: false, banner: false })
    const [settings, setSettings] = useState({
        primary_color: '#F97316',
        secondary_color: '#EAB308',
        logo_url: null,
        banner_url: null,
        config: {}
    })

    const restaurantId = tenant?.id

    useEffect(() => {
        if (restaurantId) loadSettings()
    }, [restaurantId])

    useEffect(() => {
        onPreviewUpdate?.(settings)
    }, [settings])

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select('primary_color, secondary_color, logo_url, banner_url, config')
                .eq('id', restaurantId)
                .single()

            if (error && error.code !== 'PGRST116') throw error
            if (data) {
                setSettings({
                    primary_color: data.primary_color || '#F97316',
                    secondary_color: data.secondary_color || '#EAB308',
                    logo_url: data.logo_url,
                    banner_url: data.banner_url,
                    config: data.config || {}
                })
            }
        } catch (e) {
            console.error('Error loading settings:', e)
        } finally {
            setLoading(false)
        }
    }

    const updateConfig = (key, value) => setSettings(s => ({
        ...s, config: { ...s.config, [key]: value }
    }))

    const setColor = (key, value) => setSettings(s => ({ ...s, [key]: value }))

    const handleFileUpload = async (type, event) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            setUploading(prev => ({ ...prev, [type]: true }))
            const ext = file.name.split('.').pop()
            const path = `${restaurantId || user.id}/${type}_${Date.now()}.${ext}`
            const { error } = await supabase.storage.from('company_logos').upload(path, file, { upsert: true })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(path)
            setSettings(prev => ({ ...prev, [`${type}_url`]: publicUrl }))
            toast.success(`${type === 'logo' ? 'Logo' : 'Portada'} lista. Guarda para aplicar.`)
        } catch { toast.error('Error al subir imagen') }
        finally { setUploading(prev => ({ ...prev, [type]: false })) }
    }

    const handleSave = async () => {
        if (!restaurantId) return toast.error('No se encontró el restaurante')
        try {
            setSaving(true)
            const { error } = await supabase.from('restaurants').update({
                primary_color: settings.primary_color,
                secondary_color: settings.secondary_color,
                logo_url: settings.logo_url,
                banner_url: settings.banner_url,
                config: settings.config
            }).eq('id', restaurantId)
            if (error) throw error
            // Also sync to profiles for backward compat
            await supabase.from('profiles').update({
                primary_color: settings.primary_color,
                secondary_color: settings.secondary_color,
                logo_url: settings.logo_url,
                banner_url: settings.banner_url,
                config: settings.config
            }).eq('id', user.id)
            toast.success('Apariencia guardada ✨')
        } catch { toast.error('Error al guardar') }
        finally { setSaving(false) }
    }

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>

    const cfg = settings.config

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
            {/* ── Left: Form ── */}
            <div className="space-y-6">
                {/* Identity Card */}
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Palette className="w-5 h-5 text-primary" />
                            Identidad Visual
                        </CardTitle>
                        <CardDescription>Logo, portada y colores de tu marca</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Logo & Banner */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-muted border overflow-hidden flex items-center justify-center">
                                        {settings.logo_url
                                            ? <img src={settings.logo_url} className="w-full h-full object-contain p-1" alt="Logo" />
                                            : <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <input type="file" id="logo-input" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('logo', e)} />
                                        <Button variant="outline" size="sm" className="w-full h-9 rounded-xl"
                                            onClick={() => document.getElementById('logo-input').click()} disabled={uploading.logo}>
                                            {uploading.logo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                            Subir Logo
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portada (banner)</Label>
                                <div className="relative group rounded-2xl overflow-hidden border bg-muted h-16 flex items-center justify-center cursor-pointer"
                                    onClick={() => document.getElementById('banner-input').click()}>
                                    {settings.banner_url
                                        ? <img src={settings.banner_url} className="w-full h-full object-cover" alt="Banner" />
                                        : <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                                    }
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">{uploading.banner ? 'Subiendo...' : 'Cambiar'}</span>
                                    </div>
                                </div>
                                <input type="file" id="banner-input" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('banner', e)} />
                            </div>
                        </div>

                        {/* Colors */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                            {[
                                { label: 'Color Primario', key: 'primary_color' },
                                { label: 'Color Secundario', key: 'secondary_color' }
                            ].map(({ label, key }) => (
                                <div key={key} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
                                        <span className="w-5 h-5 rounded-full border shadow-sm" style={{ background: settings[key] }} />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {COLOR_PRESETS.map(color => (
                                            <button key={color.value}
                                                className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${settings[key] === color.value ? 'border-foreground ring-2 ring-foreground/20 scale-110' : 'border-transparent'}`}
                                                style={{ background: color.value }}
                                                onClick={() => setColor(key, color.value)}
                                                title={color.name}
                                            />
                                        ))}
                                        <div className="relative w-7 h-7 rounded-full overflow-hidden border">
                                            <input type="color" value={settings[key]}
                                                onChange={(e) => setColor(key, e.target.value)}
                                                className="absolute inset-[-10px] cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Display Options */}
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-primary" />
                            Opciones de Visualización
                        </CardTitle>
                        <CardDescription>Controla cómo se presenta tu menú a los clientes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Card Style */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estilo de Tarjeta</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { key: 'list', label: 'Lista', icon: LayoutList, desc: 'Imagen izquierda' },
                                    { key: 'card', label: 'Cuadrícula', icon: Grid3X3, desc: 'Imagen arriba' },
                                    { key: 'compact', label: 'Compacto', icon: AlignJustify, desc: 'Sin imagen' },
                                ].map(({ key, label, icon: Icon, desc }) => (
                                    <button key={key}
                                        onClick={() => updateConfig('card_style', key)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${(cfg.card_style === key || (!cfg.card_style && key === 'list')) ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted'}`}>
                                        <Icon className="w-5 h-5" />
                                        <div className="text-center">
                                            <p className="text-xs font-bold">{label}</p>
                                            <p className="text-[10px] opacity-60">{desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Elementos Visibles</Label>
                            {[
                                { key: 'show_prices', label: 'Mostrar precios', icon: DollarSign, defaultOn: true },
                                { key: 'show_description', label: 'Mostrar descripción', icon: FileText, defaultOn: true },
                            ].map(({ key, label, icon: Icon, defaultOn }) => {
                                const isOn = cfg[key] !== undefined ? cfg[key] : defaultOn
                                return (
                                    <button key={key} onClick={() => updateConfig(key, !isOn)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl border bg-background hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm font-bold">{label}</span>
                                        </div>
                                        <div className="w-11 h-6 rounded-full transition-colors flex items-center"
                                            style={{ background: isOn ? settings.primary_color : '#e2e8f0', padding: '2px' }}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Button onClick={handleSave} disabled={saving}
                    className="w-full h-12 rounded-2xl font-black text-base shadow-md">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Guardando...</> : <><Save className="w-5 h-5 mr-2" />Guardar Cambios</>}
                </Button>
            </div>

            {/* ── Right: Live Preview ── */}
            <div className="lg:sticky lg:top-6">
                <MobileLivePreview settings={settings} />
            </div>
        </div>
    )
}
