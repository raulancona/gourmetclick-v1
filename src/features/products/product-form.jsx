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
        formState: { errors }
    } = useForm({
        defaultValues: {
            name: product?.name || '',
            description: product?.description || '',
            price: product?.price || '',
            sku: product?.sku || '',
            image_url: product?.image_url || '',
            discount_percent: product?.discount_percent || 0,
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
                is_vegan: data.is_vegan,
                badge_text: data.badge_text?.trim() || null,
                is_available: data.is_available
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
                        rows={2}
                    />
                </div>

                {/* Price and SKU */}
                <div className="grid grid-cols-2 gap-4">
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
                        />
                    </div>
                    <div>
                        <Label htmlFor="sku">SKU</Label>
                        <Input id="sku" {...register('sku')} placeholder="Ej: PROD-001" />
                    </div>
                </div>

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
                        />
                    </div>
                    <div>
                        <Label htmlFor="badge_text">Badge</Label>
                        <Input
                            id="badge_text"
                            {...register('badge_text')}
                            placeholder="🔥 Top"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 py-2.5 cursor-pointer">
                            <input type="checkbox" {...register('is_vegan')} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                            <span className="text-sm font-medium text-green-700">🌱 Vegano</span>
                        </label>
                    </div>
                </div>

                {/* Available toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('is_available')} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Disponible en el menú</span>
                </label>

                {/* Modifiers Section */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Puzzle className="w-4 h-4 text-purple-600" />
                            <Label className="mb-0">Extras / Complementos</Label>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addModifier}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
                        </Button>
                    </div>

                    {loadingModifiers && (
                        <p className="text-xs text-gray-500 text-center py-2">Cargando extras...</p>
                    )}

                    {visibleModifiers.length === 0 && !loadingModifiers && (
                        <p className="text-xs text-gray-400 text-center py-3">
                            Sin extras. Agrega extras como "Queso extra", "Doble carne", etc.
                        </p>
                    )}

                    {visibleModifiers.map((mod, index) => {
                        const realIndex = modifiers.indexOf(mod)
                        return (
                            <div key={realIndex} className="flex items-center gap-2">
                                <Input
                                    value={mod.name}
                                    onChange={e => updateModifier(realIndex, 'name', e.target.value)}
                                    placeholder="Nombre del extra"
                                    className="flex-1 h-9 text-sm"
                                />
                                <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">+$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={mod.extra_price}
                                        onChange={e => updateModifier(realIndex, 'extra_price', e.target.value)}
                                        className="pl-7 h-9 text-sm"
                                    />
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeModifier(realIndex)} className="text-red-400 hover:text-red-600 h-9 w-9 p-0">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        )
                    })}
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
