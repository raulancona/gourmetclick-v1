import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Plus, Search, Image as ImageIcon, Loader2, Sparkles, Trash2, Package, Edit, Save, CheckSquare, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image-service'
import { useAuth } from '../features/auth/auth-context'
import { useTenant } from '../features/auth/tenant-context'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/modal'

export function PromotionsPage() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    
    // Check if user has permission
    if (!user || !tenant) return null

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                    Kits y Promociones
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Crea agrupaciones de productos y combos para aumentar el ticket promedio.
                </p>
            </div>
            
            <KitsCreator tenantId={tenant.id} ownerId={tenant.ownerId} user={user} />
        </div>
    )
}

function KitsCreator({ tenantId, ownerId, user }) {
    const [products, setProducts] = useState([]) // all standard products to select from
    const [kits, setKits] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingKit, setEditingKit] = useState(null)
    const [saving, setSaving] = useState(false)

    // Form State
    const [formData, setFormData] = useState({ 
        name: '', 
        description: '', 
        price: 0, 
        image_url: '',
        selectedItems: [] // { id, name, price, quantity }
    })
    const [imageFile, setImageFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState('')
    const [productSearch, setProductSearch] = useState('')

    useEffect(() => {
        loadData()
    }, [tenantId])

    const loadData = async () => {
        try {
            setLoading(true)
            const orFilter = ownerId 
                ? `restaurant_id.eq.${tenantId},user_id.eq.${tenantId},restaurant_id.eq.${ownerId},user_id.eq.${ownerId}`
                : `restaurant_id.eq.${tenantId},user_id.eq.${tenantId}`

            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, image_url, badge_text, metadata')
                .or(orFilter)
                .order('created_at', { ascending: false })
            
            if (error) throw error

            const allProducts = data || []
            setKits(allProducts.filter(p => p.badge_text === 'KIT'))
            setProducts(allProducts.filter(p => p.badge_text !== 'KIT'))
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Error al cargar la información')
        } finally {
            setLoading(false)
        }
    }

    const handleOpenModal = (kit = null) => {
        if (kit) {
            setEditingKit(kit)
            setFormData({
                name: kit.name,
                description: kit.description || '',
                price: kit.price,
                image_url: kit.image_url || '',
                selectedItems: kit.metadata?.included_items || []
            })
            setPreviewUrl(kit.image_url || '')
        } else {
            setEditingKit(null)
            setFormData({ name: '', description: '', price: 0, image_url: '', selectedItems: [] })
            setPreviewUrl('')
        }
        setProductSearch('')
        setImageFile(null)
        setIsModalOpen(true)
    }

    const handleImageChange = (e) => {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const toggleProductSelection = (product) => {
        setFormData(prev => {
            const exists = prev.selectedItems.find(item => item.id === product.id)
            if (exists) {
                return { ...prev, selectedItems: prev.selectedItems.filter(item => item.id !== product.id) }
            } else {
                return { 
                    ...prev, 
                    selectedItems: [...prev.selectedItems, { id: product.id, name: product.name, price: product.price, quantity: 1 }] 
                }
            }
        })
    }

    const updateItemQuantity = (productId, delta) => {
        setFormData(prev => {
            return {
                ...prev,
                selectedItems: prev.selectedItems.map(item => {
                    if (item.id === productId) {
                        const newQ = Math.max(1, item.quantity + delta)
                        return { ...item, quantity: newQ }
                    }
                    return item
                })
            }
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.name || formData.price <= 0) {
            toast.error('Nombre y precio válido son obligatorios')
            return
        }

        if (formData.selectedItems.length === 0) {
            toast.error('Debes incluir al menos un producto en el kit')
            return
        }

        try {
            setSaving(true)
            let finalImageUrl = formData.image_url
            let autoDescription = formData.description

            // Auto-generate description if empty based on selected items
            if (!autoDescription.trim()) {
                autoDescription = formData.selectedItems.map(item => `${item.quantity}x ${item.name}`).join(' + ')
            }

            // Upload image if new file is selected
            if (imageFile) {
                toast.loading('Subiendo imagen...', { id: 'kit-upload' })
                const compressed = await compressImage(imageFile, { maxWidth: 800, quality: 0.8 })
                const ext = compressed.name.split('.').pop() || 'webp'
                const path = `${user.id}/kits/kit-${Date.now()}.${ext}`

                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(path, compressed, { upsert: true })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(path)
                finalImageUrl = publicUrl
                toast.dismiss('kit-upload')
            }

            const kitData = {
                restaurant_id: tenantId,
                name: formData.name,
                description: autoDescription,
                price: parseFloat(formData.price),
                image_url: finalImageUrl,
                badge_text: 'KIT',
                is_available: true,
                is_active: true,
                metadata: { included_items: formData.selectedItems }
            }

            if (editingKit) {
                const { error } = await supabase
                    .from('products')
                    .update(kitData)
                    .eq('id', editingKit.id)
                if (error) throw error
                toast.success('Kit actualizado exitosamente')
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert([kitData])
                if (error) throw error
                toast.success('Kit creado exitosamente')
            }

            setIsModalOpen(false)
            loadData() // Reload to get fresh data
        } catch (error) {
            console.error('Error saving kit:', error)
            toast.error('No se pudo guardar el kit')
            toast.dismiss('kit-upload')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteKit = async (kitId) => {
        if (!confirm('¿Estás seguro de eliminar este kit?')) return
        try {
            const { error } = await supabase.from('products').delete().eq('id', kitId)
            if (error) throw error
            toast.success('Kit eliminado')
            loadData()
        } catch (error) {
            console.error('Error deleting kit:', error)
            toast.error('No se pudo eliminar el kit')
        }
    }

    const filteredKits = kits.filter(k => k.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // For the modal product selector
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))

    // Calculate original value of the kit
    const calculateOriginalValue = () => {
        return formData.selectedItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity)
        }, 0)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-500 font-medium">Cargando catálogo...</p>
            </div>
        )
    }

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-500" />
                            Catálogo de Kits
                        </CardTitle>
                        <CardDescription>
                            Agrupa productos existentes bajo un solo paquete con precio especial.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Buscar kit..." 
                                className="pl-9 bg-white"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => handleOpenModal()} className="shrink-0">
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Kit
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {filteredKits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                        <Package className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-slate-600 font-medium">No has creado ningún Kit o Combo</p>
                        <p className="text-sm text-slate-400 max-w-md text-center mt-2">
                            Agrupa productos bajo un solo precio para que aparezcan en la sección de Promociones.
                        </p>
                        <Button variant="outline" className="mt-6" onClick={() => handleOpenModal()}>
                            <Plus className="w-4 h-4 mr-2" /> Crear Primer Kit
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredKits.map(kit => (
                            <div key={kit.id} className="group relative rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col">
                                <div className="aspect-[4/3] w-full bg-slate-100 relative">
                                    {kit.image_url ? (
                                        <img src={kit.image_url} alt={kit.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="w-10 h-10 text-slate-300" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 bg-indigo-500 text-white text-[10px] uppercase font-black px-2 py-1 rounded-md shadow-sm">
                                        Combo / Kit
                                    </div>
                                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(kit)} className="w-8 h-8 rounded-full bg-white/90 shadow text-indigo-600 flex items-center justify-center hover:bg-white transition-colors">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteKit(kit.id)} className="w-8 h-8 rounded-full bg-white/90 shadow text-red-600 flex items-center justify-center hover:bg-white transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{kit.name}</h3>
                                        <p className="text-xs text-slate-500 line-clamp-2">
                                            {kit.metadata?.included_items?.map(i => `${i.quantity}x ${i.name}`).join(' + ')}
                                        </p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <span className="text-sm text-slate-500 font-medium">Precio Final</span>
                                        <span className="font-black text-lg text-indigo-600">${parseFloat(kit.price).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Modal Crear/Editar Kit */}
            <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editingKit ? "Editar Kit Promocional" : "Nuevo Kit Promocional"} size="xl">
                <form onSubmit={handleSubmit} className="p-0 flex flex-col h-full max-h-[85vh]">
                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Panel Izquierdo: Selección de Productos */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base mb-1">Paso 1: Selecciona los Productos</h3>
                                    <p className="text-xs text-slate-500 mb-3">Elige qué artículos incluye este combo.</p>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input 
                                            placeholder="Buscar productos..." 
                                            className="pl-9 h-9" 
                                            value={productSearch}
                                            onChange={e => setProductSearch(e.target.value)}
                                        />
                                    </div>
                                    
                                    <div className="border rounded-xl overflow-hidden flex flex-col">
                                        <div className="h-[260px] overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                                            {filteredProducts.map(product => {
                                                const selectedItem = formData.selectedItems.find(i => i.id === product.id)
                                                const isSelected = !!selectedItem
                                                return (
                                                    <div key={product.id} className={cn("p-2 flex items-center gap-3 hover:bg-white transition-colors cursor-pointer group", isSelected && "bg-indigo-50/50")}>
                                                        <button type="button" onClick={() => toggleProductSelection(product)} className="shrink-0 p-1">
                                                            {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-500" /> : <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400" />}
                                                        </button>
                                                        {product.image_url ? (
                                                            <img src={product.image_url} alt="" className="w-10 h-10 rounded-md object-cover border shrink-0" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-md bg-slate-100 border flex items-center justify-center shrink-0">
                                                                <ImageIcon className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0" onClick={() => !isSelected && toggleProductSelection(product)}>
                                                            <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                                                            <p className="text-xs text-slate-500">${product.price.toFixed(2)}</p>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="flex items-center bg-white border rounded-md shrink-0 h-8 mr-1 shadow-sm">
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); updateItemQuantity(product.id, -1) }} className="px-2 h-full text-slate-600 hover:bg-slate-50 rounded-l-md font-bold">-</button>
                                                                <span className="w-6 text-center text-sm font-bold">{selectedItem.quantity}</span>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); updateItemQuantity(product.id, 1) }} className="px-2 h-full text-slate-600 hover:bg-slate-50 rounded-r-md font-bold">+</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {filteredProducts.length === 0 && <div className="p-4 text-center text-sm text-slate-500">Ningún producto coincide con la búsqueda.</div>}
                                        </div>
                                        
                                        {formData.selectedItems.length > 0 && (
                                            <div className="bg-white border-t p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10">
                                                <div className="text-xs text-slate-500 font-medium mb-1">Resumen del Combo:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {formData.selectedItems.map(item => (
                                                        <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-bold border border-indigo-100">
                                                            {item.quantity}x {item.name}
                                                            <button type="button" onClick={() => toggleProductSelection({id: item.id})} className="hover:text-red-500 ml-1">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Panel Derecho: Detalles del Kit */}
                            <div className="space-y-5">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base mb-1">Paso 2: Promociona tu Combo</h3>
                                    <p className="text-xs text-slate-500 mb-4">Añade imagen y precio atractivo.</p>
                                </div>
                                
                                <div className="flex flex-col items-center gap-4 mb-2">
                                    <label className="relative w-full aspect-[21/9] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden group cursor-pointer hover:bg-slate-100 transition-colors">
                                        {previewUrl ? (
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                                                <ImageIcon className="w-8 h-8" />
                                                <span className="text-sm font-medium">Subir foto grupal del combo</span>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white font-medium text-sm">Cambiar Imagen</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 block mb-1">Nombre del Kit *</label>
                                        <Input 
                                            required 
                                            placeholder="Ej: Combo Familiar Pizzero" 
                                            value={formData.name} 
                                            onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-bold text-slate-700 block mb-1">Valor Original</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                                                <Input 
                                                    disabled
                                                    className="pl-7 bg-slate-50 text-slate-500 font-medium line-through" 
                                                    value={calculateOriginalValue().toFixed(2)} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold text-slate-700 block mb-1">Precio Cobrado *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800 font-black">$</span>
                                                <Input 
                                                    required 
                                                    type="number" 
                                                    min="0" 
                                                    step="0.01" 
                                                    className="pl-7 font-black border-indigo-200 focus-visible:ring-indigo-500" 
                                                    value={formData.price} 
                                                    onChange={e => setFormData({ ...formData, price: e.target.value })} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center px-6 py-4 border-t bg-slate-50 rounded-b-xl shrink-0">
                        <div className="text-xs text-slate-500">
                            {formData.selectedItems.length} artículos seleccionados en el combo.
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                {editingKit ? 'Guardar Cambios' : 'Crear Combo en Menú'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </Card>
    )
}
