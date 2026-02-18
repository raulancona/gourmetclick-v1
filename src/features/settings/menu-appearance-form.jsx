import { useState, useEffect } from 'react'
import { Palette, LayoutGrid, List, Image as ImageIcon, Upload, Loader2, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '../auth/auth-context'

const COLOR_PRESETS = [
    { name: 'Gourmet Red', value: '#EF4444' },
    { name: 'Luxury Orange', value: '#F97316' },
    { name: 'Golden Sun', value: '#EAB308' },
    { name: 'Fresh Green', value: '#22C55E' },
    { name: 'Classic Blue', value: '#3B82F6' },
    { name: 'Midnight', value: '#1E293B' },
]

export function MenuAppearanceForm({ onPreviewUpdate }) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState({ logo: false, banner: false })
    const [settings, setSettings] = useState({
        primary_color: '#3B82F6',
        secondary_color: '#F97316',
        logo_url: null,
        banner_url: null,
        layout_type: 'grid', // stored in config
    })

    useEffect(() => {
        loadSettings()
    }, [user])

    useEffect(() => {
        onPreviewUpdate?.(settings)
    }, [settings])

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('primary_color, secondary_color, logo_url, banner_url, config')
                .eq('id', user.id)
                .single()

            if (error) throw error
            if (data) {
                setSettings({
                    primary_color: data.primary_color || '#3B82F6',
                    secondary_color: data.secondary_color || '#F97316',
                    logo_url: data.logo_url,
                    banner_url: data.banner_url,
                    layout_type: data.config?.layout_type || 'grid',
                })
            }
        } catch (error) {
            console.error('Error loading settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = async (type, event) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            setUploading(prev => ({ ...prev, [type]: true }))
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('company_logos')
                .upload(fileName, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('company_logos')
                .getPublicUrl(fileName)

            setSettings(prev => ({ ...prev, [`${type}_url`]: publicUrl }))
            toast.success(`${type === 'logo' ? 'Logo' : 'Portada'} subida temporalmente. Guarda para aplicar.`)
        } catch (error) {
            console.error('Error uploading:', error)
            toast.error('Error al subir imagen')
        } finally {
            setUploading(prev => ({ ...prev, [type]: false }))
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            const { error } = await supabase
                .from('profiles')
                .update({
                    primary_color: settings.primary_color,
                    secondary_color: settings.secondary_color,
                    logo_url: settings.logo_url,
                    banner_url: settings.banner_url,
                    config: {
                        layout_type: settings.layout_type
                    }
                })
                .eq('id', user.id)

            if (error) throw error
            toast.success('Apariencia actualizada correctamente')
        } catch (error) {
            console.error('Error saving settings:', error)
            toast.error('Error al guardar cambios')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Palette className="w-5 h-5 text-primary" />
                        Identidad Visual
                    </CardTitle>
                    <CardDescription>Define los colores y el logo de tu marca</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Logo & Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logo Principal</Label>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-muted border overflow-hidden flex items-center justify-center">
                                    {settings.logo_url ? (
                                        <img src={settings.logo_url} className="w-full h-full object-contain p-2" alt="Logo" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-muted-foreground/20" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input type="file" id="logo-input" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('logo', e)} />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-10 rounded-xl"
                                        onClick={() => document.getElementById('logo-input').click()}
                                        disabled={uploading.logo}
                                    >
                                        {uploading.logo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                        Subir Logo
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Imagen de Portada</Label>
                            <div className="relative group rounded-2xl overflow-hidden border bg-muted h-20 flex items-center justify-center">
                                {settings.banner_url ? (
                                    <img src={settings.banner_url} className="w-full h-full object-cover" alt="Banner" />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-muted-foreground/20" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <input type="file" id="banner-input" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('banner', e)} />
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 rounded-lg"
                                        onClick={() => document.getElementById('banner-input').click()}
                                        disabled={uploading.banner}
                                    >
                                        Cambiar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color Primario</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLOR_PRESETS.map(color => (
                                    <button
                                        key={color.value}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.primary_color === color.value ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent'}`}
                                        style={{ background: color.value }}
                                        onClick={() => setSettings(s => ({ ...s, primary_color: color.value }))}
                                        title={color.name}
                                    />
                                ))}
                                <div className="relative w-8 h-8 rounded-full overflow-hidden border">
                                    <input
                                        type="color"
                                        value={settings.primary_color}
                                        onChange={(e) => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                                        className="absolute inset-[-10px] cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color Secundario</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLOR_PRESETS.map(color => (
                                    <button
                                        key={color.value}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.secondary_color === color.value ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent'}`}
                                        style={{ background: color.value }}
                                        onClick={() => setSettings(s => ({ ...s, secondary_color: color.value }))}
                                        title={color.name}
                                    />
                                ))}
                                <div className="relative w-8 h-8 rounded-full overflow-hidden border">
                                    <input
                                        type="color"
                                        value={settings.secondary_color}
                                        onChange={(e) => setSettings(s => ({ ...s, secondary_color: e.target.value }))}
                                        className="absolute inset-[-10px] cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-primary" />
                        Disposición del Menú
                    </CardTitle>
                    <CardDescription>Cómo se presentan los productos a tus clientes</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setSettings(s => ({ ...s, layout_type: 'grid' }))}
                            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${settings.layout_type === 'grid' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted'}`}
                        >
                            <LayoutGrid className="w-8 h-8" />
                            <span className="text-sm font-bold">Cuadrícula</span>
                        </button>
                        <button
                            onClick={() => setSettings(s => ({ ...s, layout_type: 'list' }))}
                            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${settings.layout_type === 'list' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted'}`}
                        >
                            <List className="w-8 h-8" />
                            <span className="text-sm font-bold">Lista Detallada</span>
                        </button>
                    </div>
                </CardContent>
            </Card>

            <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
            >
                {saving ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Guardando...</> : <><Save className="w-5 h-5 mr-2" /> Guardar Todos los Cambios</>}
            </Button>
        </div>
    )
}
