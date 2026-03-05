import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Puzzle, Image as ImageIcon, Tag, Banknote, Leaf, Sparkles, Layers, Eye } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ImageUpload } from './image-upload'
import { uploadProductImage, deleteProductImage } from '../../lib/image-service'
import { getCategories, createCategory } from '../../lib/category-service'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { supabase } from '../../lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { toast } from 'sonner'

export function ProductForm({ product, onSubmit, onCancel, isLoading }) {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const [imageFile, setImageFile] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [modifiers, setModifiers] = useState([]) // { id?, name, extra_price, _delete? }
    const [loadingModifiers, setLoadingModifiers] = useState(false)

    // Categories state
    const [categories, setCategories] = useState([])
    const [loadingCategories, setLoadingCategories] = useState(false)
    const [isCreatingCategory, setIsCreatingCategory] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors }
    } = useForm({
        defaultValues: {
            name: product?.name || '',
            description: product?.description || '',
            price: product?.price || '',
            category_id: product?.category_id || 'none', // using 'none' as default/empty
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
        if (tenant?.id) {
            loadCategories()
        }
        if (product?.id) {
            loadModifiers(product.id)
        }
    }, [product?.id, tenant?.id])

    const loadCategories = async () => {
        try {
            setLoadingCategories(true)
            const data = await getCategories(tenant.id)
            setCategories(data || [])
        } catch (error) {
            console.error('Error loading categories:', error)
        } finally {
            setLoadingCategories(false)
        }
    }

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim() || !tenant?.id) return

        try {
            setIsCreatingCategory(true)
            const newCat = await createCategory({
                name: newCategoryName.trim(),
                user_id: user.id, // Must be user.id to pass RLS, tenant.id might be a different user's ID
                restaurant_id: tenant.id
            }, user.id) // Pass user.id as the second parameter for the fallback

            setCategories(prev => [...prev, newCat])
            setValue('category_id', newCat.id, { shouldValidate: true })
            setNewCategoryName('')
            toast.success('Categoría creada')
        } catch (error) {
            console.error('Error creating category:', error)
            toast.error('Error al crear categoría')
        } finally {
            setIsCreatingCategory(false)
        }
    }

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
                toast.loading('Optimizando y subiendo imagen...', { id: 'image-upload' })
                const { data: { user } } = await import('../../lib/supabase').then(m => m.supabase.auth.getUser())
                if (product?.image_url) await deleteProductImage(product.image_url)
                imageUrl = await uploadProductImage(imageFile, user.id)
                toast.success('Imagen lista', { id: 'image-upload' })
            }

            const productData = {
                name: data.name,
                category_id: data.category_id === 'none' ? null : data.category_id,
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

            {/* Panel 1: Información Básica */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="bg-muted/30 px-5 py-4 border-b border-border/60 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm text-foreground tracking-tight">Información Principal</h3>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Detalles públicos del producto</p>
                    </div>
                </div>
                <div className="p-5 space-y-5">

                    {/* Available toggle prominent at the top */}
                    <label className="flex items-center gap-3 cursor-pointer bg-primary/5 p-4 rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors">
                        <input type="checkbox" {...register('is_available')} className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-background cursor-pointer" />
                        <div className="flex-1">
                            <span className="text-sm font-black text-foreground">Producto disponible para la venta</span>
                            <p className="text-xs text-muted-foreground font-medium">Si se desactiva, los clientes no podrán verlo ni pedirlo.</p>
                        </div>
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
                        {/* Image Upload */}
                        <div>
                            <Label className="block mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fotografía</Label>
                            <div className="aspect-square bg-muted/20 rounded-xl overflow-hidden border-2 border-dashed border-border/60 flex items-center justify-center p-1">
                                <ImageUpload
                                    value={product?.image_url}
                                    onChange={setImageFile}
                                    error={errors.image_url?.message}
                                />
                            </div>
                        </div>

                        {/* Text Infos */}
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Nombre del Producto <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    {...register('name', { required: 'El nombre es requerido' })}
                                    placeholder="Ej: Nachos con Arrachera"
                                    className="h-11 mt-1 text-foreground bg-background rounded-xl font-bold text-base shadow-sm border-border"
                                    error={errors.name?.message}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoría del Menú</Label>
                                <div className="flex gap-2 items-center">
                                    <Select
                                        value={watch('category_id') || 'none'}
                                        onValueChange={(val) => register('category_id').onChange({ target: { name: 'category_id', value: val } })}
                                        disabled={loadingCategories}
                                    >
                                        <SelectTrigger className="h-11 bg-background rounded-xl font-bold shadow-sm border-border flex-1">
                                            <SelectValue placeholder="Seleccionar categoría">
                                                {watch('category_id') === 'none' ? 'Sin Categoría' : (categories.find(c => c.id === watch('category_id'))?.name || 'Cargando...')}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 rounded-xl">
                                            <SelectItem value="none" className="italic text-muted-foreground">-- Sin Categoría --</SelectItem>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id} className="font-bold">{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Input
                                        placeholder="Crear nueva categoría..."
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        className="h-9 text-xs bg-muted/30 border-dashed border-border/60 rounded-lg flex-1"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                handleCreateCategory()
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="h-9 px-4 font-bold rounded-lg shadow-sm"
                                        onClick={handleCreateCategory}
                                        disabled={isCreatingCategory || !newCategoryName.trim()}
                                    >
                                        {isCreatingCategory ? '...' : 'Añadir'}
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descripción Corta</Label>
                                <Textarea
                                    id="description"
                                    {...register('description')}
                                    placeholder="Componentes, ingredientes y modo de preparación..."
                                    className="mt-1 text-sm text-foreground bg-background rounded-xl resize-none shadow-sm border-border h-24"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel 2: Precios y Configuración */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="bg-muted/30 px-5 py-4 border-b border-border/60 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm text-foreground tracking-tight">Precio y Finanzas</h3>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Costo, rentabilidad y descuentos</p>
                    </div>
                </div>
                <div className="p-5 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Precio Venta <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-foreground">$</span>
                                <Input
                                    id="price" type="number" step="0.01" min="0" placeholder="0.00"
                                    {...register('price', { required: true, min: 0.1 })}
                                    className="pl-8 h-11 text-foreground bg-background rounded-xl font-black text-lg shadow-sm border-border"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="costo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Costo de Insumos</Label>
                            <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                <Input
                                    id="costo" type="number" step="0.01" min="0" placeholder="0.00"
                                    {...register('costo')}
                                    className="pl-8 h-11 text-foreground bg-muted/20 rounded-xl font-bold shadow-sm border-dashed border-border/80"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="sku" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Código SKU</Label>
                            <Input id="sku" {...register('sku')} placeholder="Ej: SNA-005" className="mt-1 h-11 text-foreground bg-background rounded-xl shadow-sm border-border font-mono text-sm uppercase" />
                        </div>
                        <div>
                            <Label htmlFor="discount_percent" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descuento (%)</Label>
                            <div className="relative mt-1">
                                <Input
                                    id="discount_percent" type="number" min="0" max="100" placeholder="0"
                                    {...register('discount_percent')}
                                    className="pr-8 h-11 text-foreground bg-background rounded-xl shadow-sm border-border font-bold text-blue-600 dark:text-blue-400"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-muted-foreground/50">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Componente de Rentabilidad Automático */}
                    {(() => {
                        const price = parseFloat(watch('price'))
                        const cost = parseFloat(watch('costo'))

                        if (!price || !cost || price <= 0) return null

                        const profit = price - cost
                        const margin = (profit / price) * 100

                        let bgColor = 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                        if (margin >= 65) bgColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                        else if (margin >= 35) bgColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'

                        const cf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

                        return (
                            <div className={`p-4 rounded-xl border-2 ${bgColor} flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full animate-pulse ${margin >= 65 ? 'bg-emerald-500' : margin >= 35 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">Rentabilidad Estimada</p>
                                        <p className="text-sm font-semibold opacity-90">{margin >= 65 ? 'Excelente margen' : margin >= 35 ? 'Margen aceptable' : 'Margen en riesgo, revisar precio comercial'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-current/10">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase opacity-60 leading-none mb-1">Utilidad Bruta</p>
                                        <p className="text-lg font-black">{cf.format(profit)}</p>
                                    </div>
                                    <div className="w-px h-8 bg-current/20" />
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase opacity-60 leading-none mb-1">Margen</p>
                                        <p className="text-lg font-black">{margin.toFixed(1)}%</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Badges y Etiquetas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                        <div>
                            <Label htmlFor="badge_text" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Etiqueta Promocional (Badge)</Label>
                            <Input
                                id="badge_text" {...register('badge_text')}
                                placeholder="Ej: 🔥 Top Ventas, 👑 Chef's Choice"
                                className="mt-1 h-11 bg-background text-foreground rounded-xl shadow-sm border-border placeholder:text-muted-foreground/50"
                            />
                        </div>
                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-3 py-2 md:py-3 cursor-pointer select-none group">
                                <div className="relative flex items-center justify-center w-6 h-6 rounded border-2 border-green-500/30 group-hover:border-green-500 transition-colors bg-background">
                                    <input type="checkbox" {...register('is_vegan')} className="absolute opacity-0 w-full h-full cursor-pointer peer" />
                                    <Leaf className="w-4 h-4 text-green-500 opacity-0 peer-checked:opacity-100 scale-50 peer-checked:scale-100 transition-all duration-300" />
                                </div>
                                <div>
                                    <span className="text-sm font-black text-green-700 dark:text-green-400">Marcar como opción Vegana / Vegetariana</span>
                                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Se mostrará este icono especial en el menú público.</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel 3: Extras */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="bg-muted/30 px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-foreground tracking-tight">Personalización y Extras</h3>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Complementos agregables a este producto</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addModifier} className="h-9 px-4 rounded-xl border-purple-500/30 text-purple-700 dark:text-purple-400 font-bold hover:bg-purple-500/10 shadow-sm transition-all hover:border-purple-500">
                        <Plus className="w-4 h-4 mr-1.5" /> Nuevo Extra
                    </Button>
                </div>

                <div className="p-5">
                    {loadingModifiers && (
                        <div className="flex flex-col items-center justify-center py-8 opacity-60">
                            <div className="w-8 h-8 border-4 border-muted border-t-purple-500 rounded-full animate-spin mb-3" />
                            <p className="text-xs font-bold uppercase tracking-wider">Cargando complementos...</p>
                        </div>
                    )}

                    {visibleModifiers.length === 0 && !loadingModifiers && (
                        <div className="text-center py-10 border-2 border-dashed border-border/80 rounded-2xl bg-muted/10">
                            <Puzzle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-base font-black text-foreground mb-1">Sin extras configurados</p>
                            <p className="text-xs text-muted-foreground font-medium max-w-[280px] mx-auto">
                                Si cobras ingredientes extra como aguacate, tocino o doble carne, agrégalos aquí.
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {visibleModifiers.map((mod, index) => {
                            const realIndex = modifiers.indexOf(mod)
                            return (
                                <div key={realIndex} className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border/80 shadow-sm group hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/5 transition-all">

                                    <div className="w-8 h-8 rounded shrink-0 bg-muted/60 flex items-center justify-center cursor-move text-muted-foreground/40 group-hover:text-muted-foreground">
                                        <Layers className="w-4 h-4" />
                                    </div>

                                    <div className="flex-1">
                                        <Input
                                            value={mod.name}
                                            onChange={e => updateModifier(realIndex, 'name', e.target.value)}
                                            placeholder="Ej: Queso Gouda Extra"
                                            className="h-10 border-none bg-transparent focus-visible:ring-0 p-0 text-sm font-bold placeholder:text-muted-foreground/50 placeholder:font-medium text-foreground"
                                        />
                                    </div>

                                    <div className="relative w-32 shrink-0 bg-muted/50 rounded-lg p-1 border border-border/50">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase opacity-80">+$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={mod.extra_price}
                                            onChange={e => updateModifier(realIndex, 'extra_price', e.target.value)}
                                            className="pl-8 h-8 text-sm font-black text-right bg-transparent border-none focus-visible:ring-0 rounded-md text-foreground"
                                        />
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeModifier(realIndex)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-500/10 h-10 w-10 shrink-0 p-0 rounded-lg transition-colors opacity-50 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Footer de Acciones Fijas */}
            <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border flex items-center justify-end gap-3 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-xl -mx-6 -mb-6">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading || isUploading} className="font-bold h-11 px-6 rounded-xl hover:bg-muted">
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || isUploading} className="font-black h-11 px-8 rounded-xl shadow-lg hover:shadow-primary/25 transition-all w-full sm:w-auto">
                    {isLoading || isUploading ? (
                        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Procesando...</div>
                    ) : product ? 'Guardar Cambios' : 'Crear Producto Nuevo'}
                </Button>
            </div>
        </form>
    )
}
