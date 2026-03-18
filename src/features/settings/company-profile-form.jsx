import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
    Upload, Loader2, Link as LinkIcon, Copy, ExternalLink, Image,
    MapPin, Phone, Instagram, Facebook, X, CheckCircle2
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { toast } from 'sonner'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugify(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .slice(0, 50)
}

// ─── Address Autocomplete (OpenStreetMap Nominatim - free, no API key) ───────
function AddressAutocomplete({ value, onChange }) {
    const [suggestions, setSuggestions] = useState([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const debounceRef = useRef(null)
    const wrapperRef = useRef(null)

    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const search = useCallback((q) => {
        clearTimeout(debounceRef.current)
        if (!q || q.length < 4) { setSuggestions([]); setOpen(false); return }
        debounceRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
                    { headers: { 'Accept-Language': 'es' } }
                )
                const data = await res.json()
                setSuggestions(data)
                setOpen(data.length > 0)
            } catch { setSuggestions([]) }
            finally { setLoading(false) }
        }, 500)
    }, [])

    const handleInput = (e) => {
        onChange(e.target.value)
        search(e.target.value)
    }

    const selectSuggestion = (place) => {
        onChange(place.display_name)
        setSuggestions([])
        setOpen(false)
    }

    return (
        <div ref={wrapperRef} className="relative">
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    value={value}
                    onChange={handleInput}
                    placeholder="Busca tu dirección..."
                    className="pl-9"
                    autoComplete="off"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {open && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => selectSuggestion(s)}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors border-b last:border-b-0 border-border/50 flex items-start gap-2"
                        >
                            <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <span className="line-clamp-2 leading-tight">{s.display_name}</span>
                        </button>
                    ))}
                </div>
            )}
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
            const ext = file.name.split('.').pop()
            const path = `${user.id}/logo.${ext}`
            const { error } = await supabase.storage.from('company_logos').upload(path, file, { upsert: true })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(path)
            await supabase.from('profiles').update({ logo_url: publicUrl }).eq('id', user.id)
            setProfile(p => ({ ...p, logo_url: publicUrl }))
            toast.success('Logo actualizado ✓')
        } catch { toast.error('Error al subir logo') }
        finally { setUploading(false) }
    }

    const handleBannerUpload = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            setUploadingBanner(true)
            const ext = file.name.split('.').pop()
            const path = `${user.id}/banner.${ext}`
            const { error } = await supabase.storage.from('company_logos').upload(path, file, { upsert: true })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(path)
            await supabase.from('profiles').update({ banner_url: publicUrl }).eq('id', user.id)
            setProfile(p => ({ ...p, banner_url: publicUrl }))
            toast.success('Portada actualizada ✓')
        } catch { toast.error('Error al subir portada') }
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
                await supabase.from('restaurants').update({
                    address: address || null,
                    phone: formData.phone || null,
                    company_name: formData.company_name,
                    facebook_url: formData.facebook_url || null,
                    instagram_url: formData.instagram_url || null,
                    whatsapp_number: formData.whatsapp_number || null,
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

                        {/* Address with Autocomplete */}
                        <div className="space-y-2">
                            <Label className="font-bold">Dirección</Label>
                            <AddressAutocomplete value={address} onChange={setAddress} />
                            <p className="text-[11px] text-muted-foreground">Sugerencias reales por OpenStreetMap. Puedes escribir libremente.</p>
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

                        <Button type="submit" disabled={saving} className="w-full h-12 rounded-2xl font-black text-base shadow-md">
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Cambios'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
