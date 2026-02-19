import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Puzzle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ImageUpload } from './image-upload'
import { uploadProductImage, deleteProductImage } from '../../lib/image-service'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export function ProductForm({ product, onSubmit, onCancel, isLoading }) {
    const [imageFile, setImageFile] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [modifiers, setModifiers] = useState([]) // { id?, name, extra_price, _delete? }
    const [loadingModifiers, setLoadingModifiers] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors }
    } = useForm({
        defaultValues: {
            name: product?.name || '',
            description: product?.description || '',
            price: product?.price || '',
            sku: product?.sku || '',
            image_url: product?.image_url || '',
            discount_percent: product?.discount_percent || 0,
            costo: product?.costo || 0,
            is_vegan: product?.is_vegan || false,
            badge_text: product?.badge_text || '',
            is_available: product?.is_available !== undefined ? product.is_available : true
        }
    })

    // Load existing modifiers when editing a product
    useEffect(() => {
        if (product?.id) {
            loadModifiers(product.id)
        }
    }, [product?.id])

    const loadModifiers = async (productId) => {
        try {
            setLoadingModifiers(true)
            const { data: groups, error: groupError } = await supabase
                .from('modifier_groups')
                .select('id, name')
                .eq('product_id', productId)

            if (groupError) throw groupError
            if (!groups || groups.length === 0) { setLoadingModifiers(false); return }

            // Get options for the first group (Extras)
            const group = groups[0]
            const { data: options, error: optError } = await supabase
                .from('modifier_options')
                .select('id, name, extra_price')
                .eq('group_id', group.id)

            if (optError) throw optError

            setModifiers((options || []).map(opt => ({
                id: opt.id,
                group_id: group.id,
                name: opt.name,
                extra_price: parseFloat(opt.extra_price)
            })))
        } catch (error) {
            console.error('Error loading modifiers:', error)
        } finally {
            setLoadingModifiers(false)
        }
    }

    const addModifier = () => {
        setModifiers(prev => [...prev, { name: '', extra_price: 0, _new: true }])
    }

    const removeModifier = (index) => {
        setModifiers(prev => {
            const mod = prev[index]
            if (mod.id) {
                // Mark existing for deletion
                return prev.map((m, i) => i === index ? { ...m, _delete: true } : m)
            }
            return prev.filter((_, i) => i !== index)
        })
    }

    const updateModifier = (index, field, value) => {
        setModifiers(prev => prev.map((m, i) =>
            i === index ? { ...m, [field]: field === 'extra_price' ? parseFloat(value) || 0 : value } : m
        ))
    }

    const saveModifiers = async (productId) => {
        const activeModifiers = modifiers.filter(m => !m._delete && m.name.trim())
        const toDelete = modifiers.filter(m => m._delete && m.id)

        // Delete removed options
        for (const mod of toDelete) {
            await supabase.from('modifier_options').delete().eq('id', mod.id)
        }

        // Check if we need a group (clean up if no modifiers left)
        if (activeModifiers.length === 0) {
            // Delete empty groups
            const { data: groups } = await supabase.from('modifier_groups').select('id').eq('product_id', productId)
            if (groups?.length > 0) {
                for (const g of groups) {
                    await supabase.from('modifier_options').delete().eq('group_id', g.id)
                    await supabase.from('modifier_groups').delete().eq('id', g.id)
                }
            }
            return
        }

        // Ensure a group exists
        let groupId = activeModifiers[0]?.group_id
        if (!groupId) {
            const { data: existingGroups } = await supabase.from('modifier_groups').select('id').eq('product_id', productId)
            if (existingGroups?.length > 0) {
                groupId = existingGroups[0].id
            } else {
                const { data: newGroup, error: groupError } = await supabase
                    .from('modifier_groups')
                    .insert([{ product_id: productId, name: 'Extras', min_selection: 0, max_selection: activeModifiers.length }])
                    .select().single()
                if (groupError) throw groupError
                groupId = newGroup.id
            }
        }

        // Update max_selection
        await supabase.from('modifier_groups').update({ max_selection: activeModifiers.length }).eq('id', groupId)

        // Upsert options
        for (const mod of activeModifiers) {
            if (mod.id && !mod._new) {
                await supabase.from('modifier_options').update({ name: mod.name, extra_price: mod.extra_price }).eq('id', mod.id)
            } else {
                await supabase.from('modifier_options').insert([{ group_id: groupId, name: mod.name, extra_price: mod.extra_price }])
            }
        }
    }

    const onFormSubmit = async (data) => {
        try {
            setIsUploading(true)
            let imageUrl = product?.image_url || ''

            if (imageFile) {
                const { data: { user } } = await import('../../lib/supabase').then(m => m.supabase.auth.getUser())
                if (product?.image_url) await deleteProductImage(product.image_url)
                imageUrl = await uploadProductImage(imageFile, user.id)
            }

            const productData = {
                name: data.name,
                description: data.description || null,
                price: parseFloat(data.price),
                sku: data.sku || null,
                image_url: imageUrl || null,
                discount_percent: parseInt(data.discount_percent) || 0,
                costo: parseFloat(data.costo) || 0,
                is_vegan: data.is_vegan,
                badge_text: data.badge_text?.trim() || null,
                is_available: data.is_available,
                has_extras: modifiers.some(m => !m._delete && m.name.trim())
            }

            // Submit the product first
            const result = await onSubmit(productData)

            // Save modifiers (need the product ID)
            const productId = product?.id || result?.id
            if (productId && modifiers.length > 0) {
                await saveModifiers(productId)
            } else if (productId && modifiers.length === 0 && product?.id) {
                // Clean up modifiers if all removed
                await saveModifiers(productId)
            }
        } catch (error) {
            console.error('Error submitting form:', error)
            toast.error(error.message || 'Error al guardar el producto')
        } finally {
            setIsUploading(false)
        }
    }

    const visibleModifiers = modifiers.filter(m => !m._delete)

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="space-y-4">
                {/* Image Upload */}
                <div>
                    <Label>Imagen del producto</Label>
                    <ImageUpload
                        value={product?.image_url}
                        onChange={setImageFile}
                        error={errors.image_url?.message}
                    />
                </div>

                {/* Name */}
                <div>
                    <Label htmlFor="name">
                        Nombre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="name"
                        {...register('name', { required: 'El nombre es requerido' })}
                        placeholder="Ej: Hamburguesa Clásica"
                        className="text-foreground bg-background"
                        error={errors.name?.message}
                    />

                </div>

                {/* Description */}
                <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                        id="description"
                        {...register('description')}
                        placeholder="Descripción del producto..."
                        className="text-foreground bg-background"
                        rows={2}
                    />

                </div>

                {/* Price and SKU */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="price">
                            Precio <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            {...register('price', {
                                required: 'El precio es requerido',
                                min: { value: 0, message: 'El precio debe ser mayor a 0' }
                            })}
                            placeholder="0.00"
                            className="text-foreground bg-white dark:bg-gray-800 border-border"
                        />
                    </div>
                    <div>
                        <Label htmlFor="costo">Costo</Label>
                        <Input
                            id="costo"
                            type="number"
                            step="0.01"
                            min="0"
                            {...register('costo')}
                            placeholder="0.00"
                            className="text-foreground bg-white dark:bg-gray-800 border-border"
                        />
                    </div>
                    <div>
                        <Label htmlFor="sku" className="text-foreground">SKU</Label>
                        <Input id="sku" {...register('sku')} placeholder="Ej: PROD-001" className="text-foreground bg-white dark:bg-gray-800 border-border" />
                    </div>
                </div>

                {/* Profitability Indicator */}
                {(() => {
                    const price = parseFloat(watch('price'))
                    const cost = parseFloat(watch('costo'))

                    if (!price || !cost || price <= 0) return null

                    const profit = price - cost
                    const margin = (profit / price) * 100

                    let bgColor = 'bg-red-500/10 text-red-600 border-red-200'
                    if (margin >= 65) bgColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                    else if (margin >= 35) bgColor = 'bg-amber-500/10 text-amber-600 border-amber-200'

                    const currencyFormatter = new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN'
                    })

                    return (
                        <div className={`p-3 rounded-xl border ${bgColor} flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${margin >= 65 ? 'bg-emerald-500' : margin >= 35 ? 'bg-amber-500' : 'bg-red-500'}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Análisis de Rentabilidad</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[8px] font-bold uppercase opacity-60 leading-none mb-0.5">Utilidad</p>
                                    <p className="text-sm font-black italic">{currencyFormatter.format(profit)}</p>
                                </div>
                                <div className="text-right border-l border-current/20 pl-4">
                                    <p className="text-[8px] font-bold uppercase opacity-60 leading-none mb-0.5">Margen</p>
                                    <p className="text-sm font-black italic">{margin.toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Discount + Badges Row */}
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label htmlFor="discount_percent">Descuento %</Label>
                        <Input
                            id="discount_percent"
                            type="number"
                            min="0"
                            max="100"
                            {...register('discount_percent')}
                            placeholder="0"
                            className="bg-white dark:bg-gray-800 border-border"
                        />
                    </div>
                    <div>
                        <Label htmlFor="badge_text">Badge</Label>
                        <Input
                            id="badge_text"
                            {...register('badge_text')}
                            placeholder="🔥 Top"
                            className="bg-white dark:bg-gray-800 border-border"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 py-2.5 cursor-pointer">
                            <input type="checkbox" {...register('is_vegan')} className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 bg-background" />
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">🌱 Vegano</span>
                        </label>
                    </div>
                </div>

                {/* Available toggle */}
                <label className="flex items-center gap-2 cursor-pointer bg-muted/30 p-3 rounded-xl border border-border/50">
                    <input type="checkbox" {...register('is_available')} className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-background" />
                    <span className="text-sm font-bold text-foreground">Producto disponible para la venta</span>
                </label>


                {/* Modifiers Section */}
                <div className="border border-border rounded-2xl p-5 space-y-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Puzzle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Extras / Complementos</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Opciones adicionales del producto</p>
                            </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addModifier} className="rounded-xl border-purple-500/20 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all">
                            <Plus className="w-4 h-4 mr-1" /> Agregar
                        </Button>
                    </div>

                    {loadingModifiers && (
                        <p className="text-xs text-muted-foreground text-center py-4 italic">Cargando extras...</p>
                    )}

                    {visibleModifiers.length === 0 && !loadingModifiers && (
                        <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                            <p className="text-sm text-muted-foreground font-medium">No hay extras configurados</p>
                            <p className="text-[11px] text-muted-foreground/60 max-w-[200px] mx-auto mt-1">
                                Agrega opciones como "Queso extra", "Doble carne", "Tipo de término", etc.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        {visibleModifiers.map((mod, index) => {
                            const realIndex = modifiers.indexOf(mod)
                            return (
                                <div key={realIndex} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 shadow-sm group hover:border-purple-500/30 transition-all">
                                    <div className="flex-1">
                                        <Input
                                            value={mod.name}
                                            onChange={e => updateModifier(realIndex, 'name', e.target.value)}
                                            placeholder="Nombre: Ej. Queso extra"
                                            className="h-9 border-none bg-transparent focus-visible:ring-0 p-0 text-sm font-bold placeholder:text-muted-foreground/40"
                                        />
                                    </div>
                                    <div className="relative w-28">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/50 underline decoration-primary/30 decoration-2">PRECIO</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={mod.extra_price}
                                            onChange={e => updateModifier(realIndex, 'extra_price', e.target.value)}
                                            className="pl-14 h-9 text-xs font-black text-right bg-muted/30 border-none focus-visible:ring-0 rounded-lg"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeModifier(realIndex)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-9 w-9 p-0 rounded-lg transition-colors opacity-40 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading || isUploading}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || isUploading}>
                    {isLoading || isUploading ? 'Guardando...' : product ? 'Actualizar' : 'Crear Producto'}
                </Button>
            </div>
        </form>
    )
}
