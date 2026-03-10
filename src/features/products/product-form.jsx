import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Puzzle, Image as ImageIcon, Tag, Banknote, Leaf, Sparkles, Layers, Eye, CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ImageUpload } from './image-upload'
import { uploadProductImage, deleteProductImage } from '../../lib/image-service'
import { getCategories, createCategory } from '../../lib/category-service'
import { getProductVariants, bulkUpsertVariants } from '../../lib/product-variants-service'
import { getGlobalModifierGroups, getLinkedModifierGroups, linkModifierGroupToProduct, unlinkModifierGroupFromProduct } from '../../lib/modifier-service'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { supabase } from '../../lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'

export function ProductForm({ product, onSubmit, onCancel, isLoading }) {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const [imageFile, setImageFile] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [activeTab, setActiveTab] = useState('basic') // 'basic' | 'pricing' | 'extras'

    // Variants State
    const [hasVariants, setHasVariants] = useState(product?.has_variants || false)
    const [variants, setVariants] = useState([])
    const [loadingVariants, setLoadingVariants] = useState(false)

    // Modifiers State
    const [globalModifiers, setGlobalModifiers] = useState([])
    const [linkedModifiers, setLinkedModifiers] = useState([])
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
            price: product?.price || 0,
            category_id: product?.category_id || 'none', // using 'none' as default/empty
            sku: product?.sku || '',
            image_url: product?.image_url || '',
            discount_percent: product?.discount_percent || 0,
            costo: product?.costo || 0,
            is_vegan: product?.is_vegan || false,
            badge_text: product?.badge_text || '',
            is_available: product?.is_available !== undefined ? product.is_available : true,
            has_variants: product?.has_variants || false
        }
    })

    // Load initial data
    useEffect(() => {
        if (tenant?.id) {
            loadCategories()
            loadGlobalModifiers()
        }
        if (product?.id) {
            loadProductData(product.id)
        }
    }, [product?.id, tenant?.id])

    const loadGlobalModifiers = async () => {
        try {
            setLoadingModifiers(true)
            const globals = await getGlobalModifierGroups(tenant.id)
            setGlobalModifiers(globals || [])
        } catch (error) {
            console.error('Error loading global modifiers:', error)
        } finally {
            setLoadingModifiers(false)
        }
    }

    const loadProductData = async (productId) => {
        try {
            setLoadingVariants(true)
            const vData = await getProductVariants(productId)
            setVariants(vData || [])

            const linkedData = await getLinkedModifierGroups(productId)
            setLinkedModifiers(linkedData.map(d => d.id))
        } catch (error) {
            console.error('Error loading product config:', error)
        } finally {
            setLoadingVariants(false)
        }
    }

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

    const toggleModifierLink = (groupId) => {
        setLinkedModifiers(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        )
    }

    // Variants Management
    const addVariant = () => {
        setVariants(prev => [...prev, { name: '', price: 0, costo: 0, sku: '', is_available: true, _new: true }])
    }

    const removeVariant = (index) => {
        // If variant already in db, prompt later or just filter out. bulkUpsert handles updates/inserts. 
        // We actually need delete logic, but for now we just remove from state and let backend handle missing if we do full sync,
        // Wait, bulkUpsert won't delete missing ones. So we should flag _delete.
        setVariants(prev => prev.map((v, i) => i === index ? { ...v, _delete: true } : v))
    }

    const updateVariant = (index, field, value) => {
        setVariants(prev => prev.map((v, i) =>
            i === index ? { ...v, [field]: value } : v
        ))
    }

    const saveProductConfig = async (productId) => {
        // 1. Save Variants
        if (hasVariants) {
            const activeVariants = variants.filter(v => !v._delete && v.name.trim())
            const toDelete = variants.filter(v => v._delete && v.id)

            // Delete removed variants
            for (const v of toDelete) {
                await supabase.from('product_variants').delete().eq('id', v.id)
            }
            // Upsert active ones
            if (activeVariants.length > 0) {
                await bulkUpsertVariants(productId, activeVariants, tenant.id)
            }
        } else {
            // If hasVariants was turned off, we might want to delete all existing variants for neatness
            const { data: existing } = await supabase.from('product_variants').select('id').eq('product_id', productId)
            if (existing?.length > 0) {
                for (const v of existing) {
                    await supabase.from('product_variants').delete().eq('id', v.id)
                }
            }
        }

        // 2. Save Links to Global Modifiers
        const { data: existingLinks } = await supabase.from('product_modifier_groups').select('modifier_group_id').eq('product_id', productId)
        const existingLinkIds = existingLinks?.map(l => l.modifier_group_id) || []

        const toAdd = linkedModifiers.filter(id => !existingLinkIds.includes(id))
        const toRemove = existingLinkIds.filter(id => !linkedModifiers.includes(id))

        for (const groupId of toAdd) {
            await linkModifierGroupToProduct(groupId, productId, 0)
        }
        for (const groupId of toRemove) {
            await unlinkModifierGroupFromProduct(groupId, productId)
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
                has_extras: linkedModifiers.length > 0,
                has_variants: hasVariants
            }

            // Submit the product first
            const result = await onSubmit(productData)

            // Save variants and links
            const productId = product?.id || result?.id
            if (productId) {
                await saveProductConfig(productId)
            }
        } catch (error) {
            console.error('Error submitting form:', error)
            toast.error(error.message || 'Error al guardar el producto')
        } finally {
            setIsUploading(false)
        }
    }

    const visibleVariants = variants.filter(v => !v._delete)

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">

            {/* TABS HEADER */}
            <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-xl overflow-x-auto custom-scrollbar">
                {[
                    { id: 'basic', label: 'Detalles Básicos', icon: Tag },
                    { id: 'pricing', label: 'Precio y Config', icon: Banknote },
                    { id: 'extras', label: 'Personalización', icon: Layers }
                ].map(tab => {
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all flex-1 justify-center whitespace-nowrap",
                                isActive ? "text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeProductTab"
                                    className="absolute inset-0 bg-background rounded-lg border border-border/50"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <tab.icon className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Panel 1: Información Básica */}
            <div className={cn("bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden", activeTab !== 'basic' && "hidden")}>
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
            <div className={cn("bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden", activeTab !== 'pricing' && "hidden")}>
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

                    <label className="flex items-center gap-3 cursor-pointer bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 hover:bg-amber-500/10 transition-colors mb-4">
                        <input
                            type="checkbox"
                            checked={hasVariants}
                            onChange={(e) => setHasVariants(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 bg-background cursor-pointer"
                        />
                        <div className="flex-1">
                            <span className="text-sm font-black text-amber-900 dark:text-amber-400">Este producto tiene múltiples tamaños/variantes</span>
                            <p className="text-xs text-muted-foreground font-medium">Activa esta opción si vendes este producto en distintos tamaños (Ej. Chico, Mediano) con precios diferentes.</p>
                        </div>
                    </label>

                    {!hasVariants ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Precio Venta <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-foreground">$</span>
                                        <Input
                                            id="price" type="number" step="0.01" min="0" placeholder="0.00"
                                            {...register('price', { required: !hasVariants, min: !hasVariants ? 0.1 : 0 })}
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
                        </>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold">Tamaños / Variantes</h4>
                                    <p className="text-xs text-muted-foreground">Configura los precios de cada tamaño.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addVariant} className="h-9 px-4 rounded-xl border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold hover:bg-amber-500/10 transition-all">
                                    <Plus className="w-4 h-4 mr-1.5" /> Agregar Tamaño
                                </Button>
                            </div>

                            {loadingVariants && <p className="text-xs text-muted-foreground">Cargando variantes...</p>}

                            {visibleVariants.length === 0 && !loadingVariants && (
                                <div className="text-center py-6 border-2 border-dashed border-border/80 rounded-2xl bg-muted/10">
                                    <p className="text-sm font-bold text-muted-foreground">Aún no hay tamaños configurados.</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                {visibleVariants.map((v, index) => {
                                    const realIndex = variants.indexOf(v)
                                    return (
                                        <div key={realIndex} className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl bg-background border border-border/80 shadow-sm group">
                                            <div className="col-span-12 md:col-span-4">
                                                <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Tamaño (Ej: Chico)</Label>
                                                <Input value={v.name} onChange={e => updateVariant(realIndex, 'name', e.target.value)} placeholder="Nombre del tamaño" className="h-9 font-bold text-sm" />
                                            </div>
                                            <div className="col-span-6 md:col-span-2">
                                                <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Precio ($)</Label>
                                                <Input type="number" step="0.01" min="0" value={v.price} onChange={e => updateVariant(realIndex, 'price', e.target.value)} className="h-9 font-bold text-sm text-amber-600 dark:text-amber-400 border-amber-500/30" />
                                            </div>
                                            <div className="col-span-6 md:col-span-2">
                                                <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Costo Base</Label>
                                                <Input type="number" step="0.01" min="0" value={v.costo} onChange={e => updateVariant(realIndex, 'costo', e.target.value)} className="h-9" />
                                            </div>
                                            <div className="col-span-10 md:col-span-3">
                                                <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">SKU</Label>
                                                <Input value={v.sku} onChange={e => updateVariant(realIndex, 'sku', e.target.value)} placeholder="Opcional" className="h-9 text-xs" />
                                            </div>
                                            <div className="col-span-2 md:col-span-1 flex justify-end items-end h-[56px] pb-1">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(realIndex)} className="text-red-400 hover:text-red-600 hover:bg-red-500/10 h-9 w-9">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

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
            <div className={cn("bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden", activeTab !== 'extras' && "hidden")}>
                <div className="bg-muted/30 px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-foreground tracking-tight">Personalización y Extras</h3>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Líga tu producto a Grupos de Modificadores Globales</p>
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    {loadingModifiers ? (
                        <div className="flex flex-col items-center justify-center py-8 opacity-60">
                            <div className="w-8 h-8 border-4 border-muted border-t-purple-500 rounded-full animate-spin mb-3" />
                            <p className="text-xs font-bold uppercase tracking-wider">Cargando modificadores...</p>
                        </div>
                    ) : globalModifiers.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-border/80 rounded-2xl bg-muted/10">
                            <Puzzle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-base font-black text-foreground mb-1">Sin extras configurados</p>
                            <p className="text-xs text-muted-foreground font-medium max-w-[280px] mx-auto">
                                Ve a la sección de "Modificadores" en el panel lateral superior para crear Grupos de Extras que puedas vincular a tus productos.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {globalModifiers.map(group => {
                                const isLinked = linkedModifiers.includes(group.id)
                                return (
                                    <label key={group.id} className={cn(
                                        "flex flex-col gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                        isLinked ? "border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10" : "border-border/60 bg-background hover:bg-muted/30"
                                    )}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0",
                                                    isLinked ? "bg-purple-500 border-purple-500 text-white" : "border-muted-foreground/30"
                                                )}>
                                                    {isLinked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isLinked}
                                                    onChange={() => toggleModifierLink(group.id)}
                                                />
                                                <div>
                                                    <p className="font-bold text-sm text-foreground">{group.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Req: {group.min_selection} | Max: {group.max_selection}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-[11px] font-medium text-muted-foreground flex flex-wrap gap-1.5 pl-8">
                                            {group.modifier_options?.slice(0, 3).map(opt => (
                                                <span key={opt.id} className="px-2 py-0.5 bg-background rounded-full border border-border">
                                                    {opt.name} ({opt.extra_price > 0 ? `+$${opt.extra_price}` : 'Gratis'})
                                                </span>
                                            ))}
                                            {group.modifier_options?.length > 3 && (
                                                <span className="px-2 py-0.5 bg-background rounded-full border border-border">
                                                    +{group.modifier_options.length - 3} más
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}
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
