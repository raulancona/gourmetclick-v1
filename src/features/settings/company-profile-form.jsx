import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Upload, Loader2, Link as LinkIcon, Copy, ExternalLink, Palette, Image, Megaphone, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

const COLOR_PRESETS = [
    { name: 'Rojo', value: '#EF4444' },
    { name: 'Naranja', value: '#F97316' },
    { name: 'Amarillo', value: '#EAB308' },
    { name: 'Verde', value: '#22C55E' },
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Índigo', value: '#6366F1' },
    { name: 'Morado', value: '#A855F7' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Slate', value: '#475569' },
]

export function CompanyProfileForm() {
    const { user } = useAuth()
    const [profile, setProfile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploadingPopup, setUploadingPopup] = useState(false)
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm()

    const primaryColor = watch('primary_color') || '#3B82F6'
    const secondaryColor = watch('secondary_color') || '#F97316'
    const popupEnabled = watch('popup_enabled')

    useEffect(() => {
        loadProfile()
    }, [user])

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') throw error

            if (data) {
                setProfile(data)
                setValue('company_name', data.company_name || '')
                setValue('slug', data.slug || '')
                setValue('address', data.address || '')
                setValue('phone', data.phone || '')
                setValue('primary_color', data.primary_color || '#3B82F6')
                setValue('secondary_color', data.secondary_color || '#F97316')
                setValue('popup_enabled', data.popup_enabled || false)
                setValue('popup_title', data.popup_title || '')
                setValue('popup_description', data.popup_description || '')
                setValue('popup_link', data.popup_link || '')
            }
        } catch (error) {
            console.error('Error loading profile:', error)
        }
    }

    const handleLogoUpload = async (event) => {
        try {
            setUploading(true)
            const file = event.target.files?.[0]
            if (!file) return
            if (!file.type.startsWith('image/')) { toast.error('Selecciona una imagen'); return }
            if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }

            const fileExt = file.name.split('.').pop()
            const filePath = `${user.id}/logo.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('company_logos').upload(filePath, file, { upsert: true })
            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(filePath)
            const { error: updateError } = await supabase.from('profiles').update({ logo_url: publicUrl }).eq('id', user.id)
            if (updateError) throw updateError

            setProfile({ ...profile, logo_url: publicUrl })
            toast.success('Logo actualizado')
        } catch (error) {
            console.error('Error uploading logo:', error)
            toast.error('Error al subir el logo')
        } finally {
            setUploading(false)
        }
    }

    const handlePopupImageUpload = async (event) => {
        try {
            setUploadingPopup(true)
            const file = event.target.files?.[0]
            if (!file) return
            if (!file.type.startsWith('image/')) { toast.error('Selecciona una imagen'); return }
            if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }

            const fileExt = file.name.split('.').pop()
            const filePath = `${user.id}/popup.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('company_logos').upload(filePath, file, { upsert: true })
            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('company_logos').getPublicUrl(filePath)
            const { error: updateError } = await supabase.from('profiles').update({ popup_image_url: publicUrl }).eq('id', user.id)
            if (updateError) throw updateError

            setProfile({ ...profile, popup_image_url: publicUrl })
            toast.success('Imagen de popup actualizada')
        } catch (error) {
            console.error('Error uploading popup image:', error)
            toast.error('Error al subir la imagen')
        } finally {
            setUploadingPopup(false)
        }
    }

    const onSubmit = async (formData) => {
        try {
            setSaving(true)
            const { error } = await supabase
                .from('profiles')
                .update({
                    company_name: formData.company_name,
                    slug: formData.slug || null,
                    address: formData.address || null,
                    phone: formData.phone || null,
                    primary_color: formData.primary_color || '#3B82F6',
                    secondary_color: formData.secondary_color || '#F97316',
                    popup_enabled: formData.popup_enabled || false,
                    popup_title: formData.popup_title || null,
                    popup_description: formData.popup_description || null,
                    popup_link: formData.popup_link || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)

            if (error) throw error
            toast.success('Perfil actualizado correctamente')
            loadProfile()
        } catch (error) {
            console.error('Error updating profile:', error)
            toast.error('Error al actualizar el perfil')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Basic Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Perfil de Empresa</CardTitle>
                    <CardDescription>Configura la información de tu empresa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Logo Upload */}
                    <div className="space-y-4">
                        <Label>Logo de Empresa</Label>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={profile?.logo_url || undefined} alt="Company logo" />
                                <AvatarFallback>{profile?.company_name?.substring(0, 2).toUpperCase() || 'CO'}</AvatarFallback>
                            </Avatar>
                            <div>
                                <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                                <Button variant="outline" onClick={() => document.getElementById('logo-upload').click()} disabled={uploading}>
                                    {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Subiendo...</> : <><Upload className="mr-2 h-4 w-4" />Subir Logo</>}
                                </Button>
                                <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, WebP. Máximo 5MB.</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="company_name">Nombre de Empresa</Label>
                            <Input id="company_name" placeholder="Mi Restaurante" {...register('company_name', { required: 'Requerido' })} />
                            {errors.company_name && <p className="text-sm text-red-600">{errors.company_name.message}</p>}
                        </div>

                        {/* Slug */}
                        <div className="space-y-2">
                            <Label htmlFor="slug">
                                <LinkIcon className="w-4 h-4 inline mr-1.5" />
                                URL de tu Menú Digital
                            </Label>
                            <div className="flex items-center gap-0 border rounded-md overflow-hidden">
                                <span className="text-sm text-gray-500 bg-gray-50 px-3 py-2 border-r whitespace-nowrap">{window.location.origin}/m/</span>
                                <Input id="slug" {...register('slug', { pattern: { value: /^[a-z0-9-]+$/, message: 'Solo letras minúsculas, números y guiones' } })} placeholder="mi-restaurante" className="border-0 focus-visible:ring-0" />
                            </div>
                            {errors.slug && <p className="text-sm text-red-600">{errors.slug.message}</p>}
                            {profile?.slug && (
                                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-900 truncate">🔗 {window.location.origin}/m/{profile.slug}</p>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/m/${profile.slug}`); toast.success('URL copiada') }}>
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => window.open(`/m/${profile.slug}`, '_blank')}>
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Address & Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="address">Dirección</Label>
                            <Input id="address" {...register('address')} placeholder="Calle Principal #123, Colonia Centro" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">
                                Teléfono WhatsApp
                                <span className="text-xs text-gray-500 ml-2">(con código de país)</span>
                            </Label>
                            <Input id="phone" {...register('phone', { pattern: { value: /^[0-9]+$/, message: 'Solo números' } })} placeholder="521234567890" />
                            {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
                        </div>

                        {/* Color Picker Section */}
                        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-purple-600" />
                                <Label className="text-base font-semibold mb-0">Colores del Menú</Label>
                            </div>

                            {/* Preview Bar */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="w-10 h-10 rounded-xl shadow-sm border border-white" style={{ background: primaryColor }} />
                                <div className="w-10 h-10 rounded-xl shadow-sm border border-white" style={{ background: secondaryColor }} />
                                <div className="flex-1 text-sm text-gray-600">Vista previa de tus colores</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-gray-500 mb-1.5 block">Color Principal</Label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {COLOR_PRESETS.map(c => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setValue('primary_color', c.value)}
                                                className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${primaryColor === c.value ? 'border-gray-800 scale-110 ring-2 ring-gray-300' : 'border-transparent'}`}
                                                style={{ background: c.value }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                    <Input type="color" {...register('primary_color')} className="h-9 w-full cursor-pointer p-1" />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 mb-1.5 block">Color Secundario</Label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {COLOR_PRESETS.map(c => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setValue('secondary_color', c.value)}
                                                className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${secondaryColor === c.value ? 'border-gray-800 scale-110 ring-2 ring-gray-300' : 'border-transparent'}`}
                                                style={{ background: c.value }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                    <Input type="color" {...register('secondary_color')} className="h-9 w-full cursor-pointer p-1" />
                                </div>
                            </div>
                        </div>

                        {/* Popup Promotion Section */}
                        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Megaphone className="w-5 h-5 text-orange-500" />
                                    <Label className="text-base font-semibold mb-0">Popup Promocional</Label>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" {...register('popup_enabled')} className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                                    <span className="text-sm text-gray-600">{popupEnabled ? 'Activo' : 'Inactivo'}</span>
                                </label>
                            </div>

                            {popupEnabled && (
                                <div className="space-y-3 animate-in slide-in-from-top-2">
                                    {/* Popup Image */}
                                    <div>
                                        <Label className="text-sm">Imagen del Popup</Label>
                                        <div className="mt-1.5 flex items-center gap-3">
                                            {profile?.popup_image_url ? (
                                                <img src={profile.popup_image_url} alt="Popup" className="w-20 h-20 rounded-xl object-cover border" />
                                            ) : (
                                                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                                                    <Image className="w-8 h-8 text-gray-300" />
                                                </div>
                                            )}
                                            <div>
                                                <input type="file" id="popup-image-upload" className="hidden" accept="image/*" onChange={handlePopupImageUpload} disabled={uploadingPopup} />
                                                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('popup-image-upload').click()} disabled={uploadingPopup}>
                                                    {uploadingPopup ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Subiendo...</> : <><Upload className="mr-1 h-3 w-3" />Subir imagen</>}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="popup_title">Título</Label>
                                        <Input id="popup_title" {...register('popup_title')} placeholder="🔥 ¡Promoción Especial!" />
                                    </div>
                                    <div>
                                        <Label htmlFor="popup_description">Descripción</Label>
                                        <Textarea id="popup_description" {...register('popup_description')} placeholder="2x1 en hamburguesas todos los martes..." rows={2} />
                                    </div>
                                    <div>
                                        <Label htmlFor="popup_link">Link del botón (opcional)</Label>
                                        <Input id="popup_link" {...register('popup_link')} placeholder="https://..." />
                                    </div>

                                    {/* Live preview */}
                                    {(watch('popup_title') || profile?.popup_image_url) && (
                                        <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
                                            <p className="text-xs text-gray-400 mb-2 text-center">Vista previa del popup</p>
                                            <div className="bg-white rounded-2xl shadow-lg p-4 max-w-xs mx-auto">
                                                {profile?.popup_image_url && (
                                                    <img src={profile.popup_image_url} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-3" />
                                                )}
                                                {watch('popup_title') && <p className="font-bold text-gray-900 text-center">{watch('popup_title')}</p>}
                                                {watch('popup_description') && <p className="text-sm text-gray-600 text-center mt-1">{watch('popup_description')}</p>}
                                                {watch('popup_link') && (
                                                    <div className="mt-3 text-center">
                                                        <span className="px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: primaryColor }}>Ver más</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted" />
                            <p className="text-xs text-muted-foreground">El correo no se puede modificar</p>
                        </div>

                        <Button type="submit" disabled={saving} className="w-full">
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Cambios'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
