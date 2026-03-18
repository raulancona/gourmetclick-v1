import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
    Upload, Loader2, Link as LinkIcon, Copy, ExternalLink, Image,
    MapPin, Phone, Instagram, Facebook, X, CheckCircle2, Clock, LocateFixed
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/image-service'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { toast } from 'sonner'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix React-Leaflet icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugify(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .slice(0, 50)
}

// ─── Map Location Picker (Nominatim + Leaflet) ───────────────────────────────
function MapLocationPicker({ value, onChange }) {
    const [position, setPosition] = useState([20.967, -89.624]) // Default Mérida
    const [searchQuery, setSearchQuery] = useState(value || '')
    const [loading, setLoading] = useState(false)
    const debounceRef = useRef(null)

    // Sync input with external value
    useEffect(() => {
        if (value && value !== searchQuery) {
            setSearchQuery(value)
        }
    }, [value])

    // Reverse Geocoding when clicking map
    const LocationFinder = () => {
        useMapEvents({
            click(e) {
                const { lat, lng } = e.latlng
                setPosition([lat, lng])
                setLoading(true)
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.display_name) {
                            setSearchQuery(data.display_name)
                            onChange(data.display_name)
                        }
                    })
                    .finally(() => setLoading(false))
            },
        })
        return null
    }

    // Map controller to animate center changes
    const MapController = ({ center }) => {
        const map = useMap()
        useEffect(() => {
            if (center) map.flyTo(center, 15)
        }, [center, map])
        return null
    }

    const handleSearch = (e) => {
        const q = e.target.value
        setSearchQuery(q)
        onChange(q) // Always update the value so typing works smoothly
        
        clearTimeout(debounceRef.current)
        if (q.length > 5) {
            debounceRef.current = setTimeout(() => {
                setLoading(true)
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`)
                    .then(r => r.json())
                    .then(results => {
                        if (results && results.length > 0) {
                            setPosition([parseFloat(results[0].lat), parseFloat(results[0].lon)])
                        }
                    })
                    .finally(() => setLoading(false))
            }, 800)
        }
    }

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            toast.error('Tu navegador no soporta geolocalización')
            return
        }
        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords
                setPosition([latitude, longitude])
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.display_name) {
                            setSearchQuery(data.display_name)
                            onChange(data.display_name)
                            toast.success('Ubicación capturada')
                        }
                    })
                    .catch(() => toast.error('Error al obtener la dirección'))
                    .finally(() => setLoading(false))
            },
            () => {
                setLoading(false)
                toast.error('Permiso de ubicación denegado')
            }
        )
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    value={searchQuery}
                    onChange={handleSearch}
                    placeholder="Escribe la dirección o toca el mapa"
                    className="pl-9 pr-24"
                    autoComplete="off"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            
            <div className="h-48 rounded-xl overflow-hidden border border-border/50 relative z-0 group">
                <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="h-full w-full">
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <LocationFinder />
                    <MapController center={position} />
                    <Marker position={position} />
                </MapContainer>
                
                <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleLocateMe}
                    disabled={loading}
                    className="absolute bottom-3 right-3 z-[1000] shadow-xl text-xs flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 text-primary" />}
                    Mi Ubicación
                </Button>
            </div>
        </div>
    )
}


// ─── Main Form ────────────────────────────────────────────────────────────────
export function CompanyProfileForm() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const [profile, setProfile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [uploadingBanner, setUploadingBanner] = useState(false)
    const [saving, setSaving] = useState(false)
    const [address, setAddress] = useState('')
    const [slugPreview, setSlugPreview] = useState('')
    const [slugAvailable, setSlugAvailable] = useState(null)
    const slugDebounce = useRef(null)
    const [hours, setHours] = useState({
        lunes:     { open: '09:00', close: '21:00', closed: false },
        martes:    { open: '09:00', close: '21:00', closed: false },
        miércoles: { open: '09:00', close: '21:00', closed: false },
        jueves:    { open: '09:00', close: '21:00', closed: false },
        viernes:   { open: '09:00', close: '21:00', closed: false },
        sábado:    { open: '10:00', close: '22:00', closed: false },
        domingo:   { open: '10:00', close: '20:00', closed: false },
    })

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm()
    const companyName = watch('company_name')

    // Auto-generate slug from company name (only if slug is empty)
    useEffect(() => {
        if (companyName && !slugPreview) {
            const auto = slugify(companyName)
            setSlugPreview(auto)
            setValue('slug', auto)
        }
    }, [companyName])

    useEffect(() => { if (user) loadProfile() }, [user])

    const loadProfile = async () => {
        try {
            // Load from profiles
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            // Also load from restaurants for company_name if not in profile
            const { data: r } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).limit(1).maybeSingle()

            const merged = {
                company_name: p?.company_name || r?.name || '',
                slug: p?.slug || r?.slug || '',
                address: p?.address || r?.address || '',
                phone: p?.phone || r?.phone || '',
                facebook_url: p?.facebook_url || '',
                instagram_url: p?.instagram_url || '',
                whatsapp_number: p?.whatsapp_number || p?.phone || '',
                ...p
            }

            if (r?.config?.hours) setHours(r.config.hours)

            setProfile(merged)
            setValue('company_name', merged.company_name)
            setValue('slug', merged.slug)
            setValue('phone', merged.phone)
            setValue('facebook_url', merged.facebook_url || '')
            setValue('instagram_url', merged.instagram_url || '')
            setValue('whatsapp_number', merged.whatsapp_number || '')
            setAddress(merged.address || '')
            setSlugPreview(merged.slug || '')
        } catch (e) {
            console.error('Error loading profile:', e)
        }
    }

    const handleSlugChange = (e) => {
        const raw = e.target.value
        // Replace spaces with dashes in real-time
        const clean = raw.replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '').toLowerCase()
        setSlugPreview(clean)
        setValue('slug', clean)

        clearTimeout(slugDebounce.current)
        slugDebounce.current = setTimeout(async () => {
            if (!clean) return
            const { data } = await supabase.from('profiles').select('id').eq('slug', clean).neq('id', user.id)
            setSlugAvailable(data?.length === 0)
        }, 600)
    }

    const handleLogoUpload = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            setUploading(true)
            toast.loading('Optimizando logo...', { id: 'logo-upload' })
            const compressedFile = await compressImage(file, { maxWidth: 800, quality: 0.8 })
            
            const ext = compressedFile.name.split('.').pop()
            const path = `${user.id}/logo-${Date.now()}.${ext}`
            
            const { error } = await supabase.storage.from('company_logos').upload(path, compressedFile, { upsert: true })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(path)
            
            await supabase.from('profiles').update({ logo_url: publicUrl }).eq('id', user.id)
            setProfile(p => ({ ...p, logo_url: publicUrl }))
            toast.success('Logo actualizado ✓', { id: 'logo-upload' })
        } catch { toast.error('Error al subir logo', { id: 'logo-upload' }) }
        finally { setUploading(false) }
    }

    const handleBannerUpload = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            setUploadingBanner(true)
            toast.loading('Optimizando portada...', { id: 'banner-upload' })
            const compressedFile = await compressImage(file, { maxWidth: 1200, quality: 0.8 })
            
            const ext = compressedFile.name.split('.').pop()
            const path = `${user.id}/banner-${Date.now()}.${ext}`
            
            const { error } = await supabase.storage.from('company_logos').upload(path, compressedFile, { upsert: true })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(path)
            
            await supabase.from('profiles').update({ banner_url: publicUrl }).eq('id', user.id)
            setProfile(p => ({ ...p, banner_url: publicUrl }))
            toast.success('Portada actualizada ✓', { id: 'banner-upload' })
        } catch { toast.error('Error al subir portada', { id: 'banner-upload' }) }
        finally { setUploadingBanner(false) }
    }

    const onSubmit = async (formData) => {
        try {
            setSaving(true)
            const payload = {
                company_name: formData.company_name,
                slug: slugPreview || null,
                address: address || null,
                phone: formData.phone || null,
                facebook_url: formData.facebook_url || null,
                instagram_url: formData.instagram_url || null,
                whatsapp_number: formData.whatsapp_number || null,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
            if (error) throw error

            // Sync key fields to restaurants too
            if (tenant?.id) {
                const { data: cur } = await supabase.from('restaurants').select('config').eq('id', tenant.id).single()
                await supabase.from('restaurants').update({
                    address: address || null,
                    phone: formData.phone || null,
                    company_name: formData.company_name,
                    facebook_url: formData.facebook_url || null,
                    instagram_url: formData.instagram_url || null,
                    whatsapp_number: formData.whatsapp_number || null,
                    config: { ...(cur?.config || {}), hours }
                }).eq('id', tenant.id)
            }

            toast.success('Perfil actualizado correctamente ✓')
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const menuUrl = `${window.location.origin}/m/${slugPreview}`

    return (
        <div className="space-y-6">
            {/* ── Logo & Banner ── */}
            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Logo y Portada</CardTitle>
                    <CardDescription>Imágenes que verán tus clientes en el menú digital</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Logo */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logo</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20 rounded-2xl">
                                    <AvatarImage src={profile?.logo_url} className="object-contain" />
                                    <AvatarFallback className="rounded-2xl text-lg font-black">
                                        {profile?.company_name?.charAt(0)?.toUpperCase() || 'R'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                    <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload').click()} disabled={uploading} className="w-full rounded-xl">
                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        Subir Logo
                                    </Button>
                                    <p className="mt-1.5 text-[11px] text-muted-foreground">PNG, JPG · Máx. 5MB</p>
                                </div>
                            </div>
                        </div>

                        {/* Banner */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portada</Label>
                            <div className="relative group rounded-2xl overflow-hidden border bg-muted h-20 flex items-center justify-center cursor-pointer" onClick={() => document.getElementById('banner-upload').click()}>
                                {profile?.banner_url
                                    ? <img src={profile.banner_url} className="w-full h-full object-cover" alt="Banner" />
                                    : <div className="flex flex-col items-center gap-1 text-muted-foreground/50"><Image className="w-6 h-6" /><span className="text-[10px]">Sin portada</span></div>
                                }
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-bold bg-black/40 px-3 py-1 rounded-full">{uploadingBanner ? 'Subiendo...' : 'Cambiar'}</span>
                                </div>
                            </div>
                            <input type="file" id="banner-upload" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                            <p className="text-[10px] text-muted-foreground">Recomendado: 1200×400px</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Business Info ── */}
            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Información del Negocio</CardTitle>
                    <CardDescription>Datos que aparecerán en tu menú público</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Company Name */}
                        <div className="space-y-2">
                            <Label htmlFor="company_name" className="font-bold">Nombre del Negocio</Label>
                            <Input
                                id="company_name"
                                placeholder="Ej. Tacos El Güero"
                                {...register('company_name', { required: 'Requerido' })}
                            />
                            {errors.company_name && <p className="text-xs text-red-500">{errors.company_name.message}</p>}
                        </div>

                        {/* Slug / Menu URL */}
                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-1.5">
                                <LinkIcon className="w-3.5 h-3.5" />
                                URL de tu Menú Digital
                            </Label>
                            <div className="flex items-center gap-0 border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
                                <span className="text-sm text-muted-foreground bg-muted px-3 py-2.5 border-r border-border whitespace-nowrap shrink-0">
                                    {window.location.origin}/m/
                                </span>
                                <input
                                    value={slugPreview}
                                    onChange={handleSlugChange}
                                    placeholder="mi-restaurante"
                                    className="flex-1 px-3 py-2.5 text-sm bg-background outline-none min-w-0"
                                />
                                {slugPreview && (
                                    <div className="px-3">
                                        {slugAvailable === true && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                        {slugAvailable === false && <X className="w-4 h-4 text-red-500" />}
                                    </div>
                                )}
                            </div>
                            {slugPreview && (
                                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                                    <p className="text-sm text-primary truncate font-medium">🔗 {menuUrl}</p>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                                            onClick={() => { navigator.clipboard.writeText(menuUrl); toast.success('URL copiada') }}
                                        ><Copy className="w-4 h-4" /></Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                                            onClick={() => window.open(`/m/${slugPreview}`, '_blank')}
                                        ><ExternalLink className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            )}
                            <p className="text-[11px] text-muted-foreground">Los espacios se convierten en guiones automáticamente</p>
                        </div>

                        {/* Address with Map Picker */}
                        <div className="space-y-2">
                            <Label className="font-bold">Ubicación y Dirección</Label>
                            <MapLocationPicker value={address} onChange={setAddress} />
                            <p className="text-[11px] text-muted-foreground hidden">Sugerencias reales por OpenStreetMap.</p>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="font-bold flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" />
                                Teléfono WhatsApp
                                <span className="text-xs text-muted-foreground font-normal">(con código de país)</span>
                            </Label>
                            <Input id="phone" placeholder="521234567890" {...register('phone', { pattern: { value: /^[0-9+]+$/, message: 'Solo números y +' } })} />
                            {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                        </div>

                        {/* Email (read-only) */}
                        <div className="space-y-2">
                            <Label className="font-bold">Correo Electrónico</Label>
                            <Input value={user?.email || ''} disabled className="bg-muted text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">El correo no se puede modificar</p>
                        </div>

                        {/* ── Social Media ── */}
                        <div className="pt-4 border-t space-y-4">
                            <div>
                                <p className="font-bold text-sm">Redes Sociales</p>
                                <p className="text-xs text-muted-foreground">Aparecerán como iconos en tu menú digital</p>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold flex items-center gap-2 text-muted-foreground">
                                        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
                                            <Facebook className="w-3 h-3 text-white" />
                                        </div>
                                        Facebook
                                    </Label>
                                    <Input placeholder="https://facebook.com/tu-pagina" {...register('facebook_url')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold flex items-center gap-2 text-muted-foreground">
                                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 flex items-center justify-center">
                                            <Instagram className="w-3 h-3 text-white" />
                                        </div>
                                        Instagram
                                    </Label>
                                    <Input placeholder="https://instagram.com/tu-perfil" {...register('instagram_url')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold flex items-center gap-2 text-muted-foreground">
                                        <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center">
                                            <Phone className="w-3 h-3 text-white" />
                                        </div>
                                        WhatsApp (número directo, con código de país)
                                    </Label>
                                    <Input placeholder="521234567890" {...register('whatsapp_number')} />
                                </div>
                            </div>
                        </div>

                        {/* ── Horario de Atención ── */}
                        <div className="pt-4 border-t space-y-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <div>
                                    <p className="font-bold text-sm">Horario de Atención</p>
                                    <p className="text-xs text-muted-foreground">Aparecerá en tu menú público</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(hours).map(([day, h]) => (
                                    <div key={day} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                                        <span className="text-sm font-bold capitalize">{day}</span>
                                        <input
                                            type="time" value={h.open}
                                            disabled={h.closed}
                                            onChange={e => setHours(prev => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))}
                                            className="text-xs border rounded-lg px-2 py-1.5 bg-background disabled:opacity-30 w-24"
                                        />
                                        <input
                                            type="time" value={h.close}
                                            disabled={h.closed}
                                            onChange={e => setHours(prev => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))}
                                            className="text-xs border rounded-lg px-2 py-1.5 bg-background disabled:opacity-30 w-24"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setHours(prev => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }))}
                                            className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-colors ${
                                                h.closed ? 'bg-red-50 text-red-500 border-red-200' : 'bg-green-50 text-green-600 border-green-200'
                                            }`}
                                        >
                                            {h.closed ? 'Cerrado' : 'Abierto'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button type="submit" disabled={saving} className="w-full h-12 rounded-2xl font-black text-base shadow-md">
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Cambios'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
