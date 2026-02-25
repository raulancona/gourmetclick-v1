import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
    Search, ShoppingBag, X, Plus, Minus, Trash2, Send, MapPin, Clock, Star,
    ChevronDown, User, Phone, MessageCircle, CreditCard, Banknote, Building2,
    MapPinned, Loader2, Leaf, Tag, UtensilsCrossed, ChevronRight, CheckCircle2
} from 'lucide-react'

import { getRestaurantBySlug, getMenuBySlug } from '../lib/restaurant-service'
import { getCategoriesBySlug } from '../lib/category-service'
import { trackVisit } from '../lib/analytics-service'
import { useCategorySubscription } from '../hooks/use-category-subscription'
import { generateWhatsAppMessage, sendWhatsAppOrder } from '../lib/whatsapp-service'
import { createOrder } from '../lib/order-service'
import { toast } from 'sonner'

// ─── Cart Context (inline for self-contained public page) ─────────────────────
import { createContext, useContext } from 'react'

const CartCtx = createContext()
function useCart() { return useContext(CartCtx) }

function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gourmetclick_cart') || '[]') }
        catch { return [] }
    })

    useEffect(() => { localStorage.setItem('gourmetclick_cart', JSON.stringify(items)) }, [items])

    const areModifiersEqual = (m1, m2) => {
        if (!m1 && !m2) return true
        if (!m1 || !m2) return false
        if (m1.length !== m2.length) return false
        const sorted1 = [...m1].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        const sorted2 = [...m2].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        return sorted1.every((mod, index) => {
            const other = sorted2[index]
            return mod.name === other.name && mod.extra_price === other.extra_price && mod.value === other.value
        })
    }

    const addItem = (product, modifiers = [], quantity = 1) => {
        setItems(prev => {
            const existingIndex = prev.findIndex(item =>
                item.product.id === product.id &&
                areModifiersEqual(item.modifiers, modifiers)
            )

            if (existingIndex > -1) {
                return prev.map((item, idx) => {
                    if (idx === existingIndex) {
                        const newQuantity = item.quantity + quantity
                        const base = parseFloat(item.product.price)
                        const discountPct = parseInt(item.product.discount_percent) || 0
                        const discountedBase = discountPct > 0 ? base * (1 - discountPct / 100) : base
                        const mods = item.modifiers.reduce((s, m) => s + parseFloat(m.extra_price || 0), 0)
                        return { ...item, quantity: newQuantity, subtotal: (discountedBase + mods) * newQuantity }
                    }
                    return item
                })
            }

            const basePrice = parseFloat(product.price)
            const modsTotal = modifiers.reduce((s, m) => s + parseFloat(m.extra_price || 0), 0)
            const discountPct = parseInt(product.discount_percent) || 0
            const discountedBase = discountPct > 0 ? basePrice * (1 - discountPct / 100) : basePrice
            return [...prev, {
                id: Date.now() + Math.random(),
                product, modifiers, quantity,
                subtotal: (discountedBase + modsTotal) * quantity
            }]
        })
    }

    const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

    const updateQuantity = (id, qty) => {
        if (qty <= 0) return removeItem(id)
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i
            const base = parseFloat(i.product.price)
            const discountPct = parseInt(i.product.discount_percent) || 0
            const discountedBase = discountPct > 0 ? base * (1 - discountPct / 100) : base
            const mods = i.modifiers.reduce((s, m) => s + parseFloat(m.extra_price || 0), 0)
            return { ...i, quantity: qty, subtotal: (discountedBase + mods) * qty }
        }))
    }

    const clearCart = () => setItems([])
    const getTotal = () => items.reduce((s, i) => s + i.subtotal, 0)
    const getItemCount = () => items.reduce((s, i) => s + i.quantity, 0)

    return (
        <CartCtx.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, getTotal, getItemCount }}>
            {children}
        </CartCtx.Provider>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PublicMenuPage() {
    const { slug } = useParams()
    const [restaurant, setRestaurant] = useState(null)
    const [categories, setCategories] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [showCart, setShowCart] = useState(false)
    const [showCheckout, setShowCheckout] = useState(false)
    const [showPopup, setShowPopup] = useState(false)

    useEffect(() => {
        loadMenu()
        initGuestId()
    }, [slug])

    const initGuestId = () => {
        let guestId = localStorage.getItem('gc_guest_id')
        if (!guestId) {
            guestId = crypto.randomUUID()
            localStorage.setItem('gc_guest_id', guestId)
        }
        return guestId
    }

    const loadMenu = async () => {
        try {
            const data = await getMenuBySlug(slug)
            setRestaurant(data.restaurant)
            setCategories(data.categories)
            setProducts(data.products)
            await trackVisit(data.restaurant.id, navigator.userAgent).catch(() => { })
            // Show popup if enabled
            if (data.restaurant.popup_enabled && (data.restaurant.popup_title || data.restaurant.popup_image_url)) {
                const popupKey = `popup_dismissed_${data.restaurant.id} `
                if (!sessionStorage.getItem(popupKey)) {
                    setTimeout(() => setShowPopup(true), 800)
                }
            }
        } catch (err) {
            console.error('Error loading menu:', err)
            setError(true)
        } finally {
            setLoading(false)
        }
    }

    // Filter products
    const filteredProducts = products.filter(p => {
        const matchesSearch = !searchTerm ||
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory
        return matchesSearch && matchesCategory
    })

    // Group by category
    const getGroupedProducts = () => {
        const groups = []
        categories.forEach(cat => {
            const catProducts = filteredProducts.filter(p => p.category_id === cat.id)
            if (catProducts.length > 0) groups.push({ id: cat.id, name: cat.name, products: catProducts })
        })
        const uncategorized = filteredProducts.filter(p => !p.category_id || !categories.find(c => c.id === p.category_id))
        if (uncategorized.length > 0) groups.push({ id: 'uncategorized', name: 'Otros', products: uncategorized })
        return groups
    }

    const primaryColor = restaurant?.primary_color || '#FF6B35'
    const secondaryColor = restaurant?.secondary_color || '#F97316'

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-white animate-spin"></div>
                    </div>
                    <p className="text-white/60 text-sm font-medium tracking-wider uppercase">Cargando menú...</p>
                </div>
            </div>
        )
    }

    if (error || !restaurant) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
                <div className="text-center px-6">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <ShoppingBag className="w-10 h-10 text-white/30" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Restaurante no encontrado</h1>
                    <p className="text-white/50">Verifica la URL e intenta nuevamente</p>
                </div>
            </div>
        )
    }

    const groupedProducts = getGroupedProducts()

    return (
        <div className="public-menu-root">
            <CartProvider>
                <MenuContent
                    restaurant={restaurant}
                    categories={categories}
                    products={products}
                    filteredProducts={filteredProducts}
                    groupedProducts={groupedProducts}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    selectedProduct={selectedProduct}
                    setSelectedProduct={setSelectedProduct}
                    showCart={showCart}
                    setShowCart={setShowCart}
                    showCheckout={showCheckout}
                    setShowCheckout={setShowCheckout}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                />

                {/* Promo Popup */}
                {showPopup && (
                    <PromoPopup
                        restaurant={restaurant}
                        primaryColor={primaryColor}
                        onClose={() => {
                            setShowPopup(false)
                            sessionStorage.setItem(`popup_dismissed_${restaurant.id} `, '1')
                        }}
                    />
                )}
            </CartProvider>
        </div>
    )
}


function PromoPopup({ restaurant, primaryColor, onClose }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
            <div
                className="relative bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl animate-in zoom-in-90 duration-300"
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center hover:bg-black/50 transition-colors">
                    <X className="w-4 h-4" />
                </button>
                {restaurant.popup_image_url && (
                    <img src={restaurant.popup_image_url} alt="" className="w-full h-48 object-cover" />
                )}
                <div className="p-6 text-center">
                    {restaurant.popup_title && (
                        <h3 className="text-xl font-black text-gray-900 mb-2">{restaurant.popup_title}</h3>
                    )}
                    {restaurant.popup_description && (
                        <p className="text-sm text-gray-600 leading-relaxed">{restaurant.popup_description}</p>
                    )}
                    {restaurant.popup_link ? (
                        <a
                            href={restaurant.popup_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-4 px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 hover:opacity-90"
                            style={{ background: primaryColor }}
                        >
                            Ver más →
                        </a>
                    ) : (
                        <button
                            onClick={onClose}
                            className="mt-4 px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
                            style={{ background: primaryColor }}
                        >
                            ¡Entendido!
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Menu Content (needs cart context) ────────────────────────────────────────
function MenuContent({
    restaurant, categories, filteredProducts, groupedProducts,
    searchTerm, setSearchTerm, selectedCategory, setSelectedCategory,
    selectedProduct, setSelectedProduct, showCart, setShowCart,
    showCheckout, setShowCheckout, primaryColor, secondaryColor
}) {
    const { getItemCount, getTotal } = useCart()
    const itemCount = getItemCount()
    const categoryScrollRef = useRef(null)

    return (
        <div className="min-h-screen scrollbar-hide" style={{ background: '#FAFAFA' }}>
            {/* ─── Hero Header ───────────────────────────────────── */}
            <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}dd 0%, ${primaryColor} 50%, ${primaryColor}bb 100%)` }}>
                {restaurant.banner_url && (
                    <div className="absolute inset-0">
                        <img src={restaurant.banner_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                    </div>
                )}
                <div className="relative z-10 px-5 pt-8 pb-6">
                    <div className="max-w-lg mx-auto">
                        <div className="flex items-center gap-4 mb-5">
                            {restaurant.logo_url ? (
                                <img src={restaurant.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-xl" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                                    <span className="text-2xl font-black text-white">{restaurant.company_name?.charAt(0) || 'R'}</span>
                                </div>
                            )}
                            <div className="flex-1">
                                <h1 className="text-2xl font-black text-white tracking-tight">{restaurant.company_name || 'Menú Digital'}</h1>
                                {restaurant.address && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <MapPin className="w-3.5 h-3.5 text-white/70" />
                                        <span className="text-sm text-white/80">{restaurant.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="¿Qué se te antoja hoy?"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl text-gray-800 placeholder-gray-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-[15px]"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Category Tabs ─────────────────────────────────── */}
            {categories.length > 0 && (
                <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm transition-all duration-300">
                    <div className="max-w-lg mx-auto">
                        <div ref={categoryScrollRef} className="flex gap-2 px-4 py-3.5 overflow-x-auto scrollbar-hide scroll-smooth">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-5 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all duration-300 ${selectedCategory === 'all'
                                    ? 'shadow-[0_4px_12px_rgba(0,0,0,0.1)] scale-105'
                                    : 'opacity-60 hover:opacity-100 scale-100'
                                    }`}
                                style={selectedCategory === 'all'
                                    ? { background: primaryColor, color: '#fff' }
                                    : { background: '#f8fafc', color: '#64748b' }
                                }
                            >
                                ✨ Todos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-5 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all duration-300 ${selectedCategory === cat.id
                                        ? 'shadow-[0_4px_12px_rgba(0,0,0,0.1)] scale-105'
                                        : 'opacity-60 hover:opacity-100 scale-100'
                                        }`}
                                    style={selectedCategory === cat.id
                                        ? { background: primaryColor, color: '#fff' }
                                        : { background: '#f8fafc', color: '#64748b' }
                                    }
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}


            {/* ─── Products ──────────────────────────────────────── */}
            <main className="max-w-lg mx-auto px-4 py-6 pb-32">
                {groupedProducts.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">No se encontraron productos</p>
                        <p className="text-gray-400 text-sm mt-1">Intenta con otro término de búsqueda</p>
                    </div>
                ) : (
                    groupedProducts.map(group => (
                        <div key={group.id} className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }}></div>
                                {group.name}
                            </h2>
                            <div className="space-y-3">
                                {group.products.map(product => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        primaryColor={primaryColor}
                                        secondaryColor={secondaryColor}
                                        onClick={() => setSelectedProduct(product)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </main>

            {/* ─── Floating Cart Button ──────────────────────────── */}
            {itemCount > 0 && !showCart && !showCheckout && (
                <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-6">
                    <div className="max-w-lg mx-auto">
                        <button
                            onClick={() => setShowCart(true)}
                            className="w-full py-4 px-6 rounded-2xl text-white font-bold text-base flex items-center justify-between shadow-2xl transition-all active:scale-[0.98]"
                            style={{ background: primaryColor, boxShadow: `0 8px 32px ${primaryColor} 50` }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <ShoppingBag className="w-5 h-5" />
                                </div>
                                <span>Ver pedido ({itemCount})</span>
                            </div>
                            <span className="text-lg">${getTotal().toFixed(2)}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Product Detail Modal ──────────────────────────── */}
            {selectedProduct && (
                <ProductModal
                    product={selectedProduct}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    onClose={() => setSelectedProduct(null)}
                />
            )}

            {/* ─── Cart Panel ────────────────────────────────────── */}
            {showCart && (
                <CartPanel
                    restaurant={restaurant}
                    primaryColor={primaryColor}
                    onClose={() => setShowCart(false)}
                    onCheckout={() => { setShowCart(false); setShowCheckout(true) }}
                />
            )}

            {/* ─── Checkout Flow ─────────────────────────────────── */}
            {showCheckout && (
                <CheckoutFlow
                    restaurant={restaurant}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    onClose={() => setShowCheckout(false)}
                    onBack={() => { setShowCheckout(false); setShowCart(true) }}
                />
            )}


        </div>
    )
}

// ─── Product Card (with badges + discount) ────────────────────────────────────
// ─── Product Card (Redesigned for premium look) ────────────────────────────────
function ProductCard({ product, primaryColor, secondaryColor, onClick }) {
    const { addItem } = useCart()
    const discountPct = parseInt(product.discount_percent) || 0
    const originalPrice = parseFloat(product.price)
    const finalPrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice

    const handleQuickAdd = (e) => {
        e.stopPropagation()
        addItem(product)
        toast.success(`Agregado: ${product.name}`, {
            icon: '🛍️',
            style: { borderRadius: '1rem', background: '#fff', color: '#000' }
        })
    }

    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-[2rem] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-500 cursor-pointer border border-gray-100/50 relative mb-4 active:scale-[0.98]"
        >
            {/* Badges - Floating Style */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                {discountPct > 0 && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black text-white shadow-xl flex items-center gap-1 animate-bounce" style={{ background: '#EF4444' }}>
                        <Tag className="w-3 h-3" /> -{discountPct}%
                    </span>
                )}
                {product.badge_text && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black text-white shadow-xl flex items-center gap-1" style={{ background: secondaryColor }}>
                        <Star className="w-3 h-3 fill-white" /> {product.badge_text}
                    </span>
                )}
            </div>

            <div className="flex p-3">
                {/* Image Section */}
                <div className="w-32 h-32 flex-shrink-0 overflow-hidden rounded-[1.5rem] bg-gray-50 relative">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <UtensilsCrossed className="w-10 h-10 text-gray-200" />
                        </div>
                    )}
                    {product.is_vegan && (
                        <div className="absolute bottom-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur shadow-sm border border-green-100">
                            <Leaf className="w-3.5 h-3.5 text-green-500 fill-green-500" />
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="flex-1 pl-4 flex flex-col justify-between py-1 pr-1 min-w-0">
                    <div>
                        <h3 className="font-black text-gray-900 text-[16px] leading-tight mb-1 group-hover:text-primary transition-colors truncate">
                            {product.name}
                        </h3>
                        {product.description && (
                            <p className="text-[12px] text-gray-400 line-clamp-2 leading-relaxed font-medium">
                                {product.description}
                            </p>
                        )}
                        {/* Extras indicator */}
                        {product.has_extras && (
                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-500 border border-orange-100">
                                ✨ Personalizable
                            </span>
                        )}
                    </div>

                    <div className="flex items-end justify-between mt-2">
                        <div className="flex flex-col">
                            {discountPct > 0 && (
                                <span className="text-[11px] line-through text-gray-300 font-bold leading-none mb-0.5">
                                    ${originalPrice.toFixed(0)}
                                </span>
                            )}
                            <span className="text-xl font-black tracking-tight" style={{ color: discountPct > 0 ? '#EF4444' : primaryColor }}>
                                ${finalPrice.toFixed(0)}
                            </span>
                        </div>

                        <button
                            onClick={handleQuickAdd}
                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 group/btn"
                            style={{
                                background: primaryColor,
                                boxShadow: `0 8px 16px ${primaryColor}40`
                            }}
                        >
                            <Plus className="w-6 h-6 group-hover/btn:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}


// ─── Product Modal (Refined Aesthetics) ──────────────────────────────────────
function ProductModal({ product, primaryColor, secondaryColor, onClose }) {
    const { addItem } = useCart()
    const [quantity, setQuantity] = useState(1)
    const [selectedModifiers, setSelectedModifiers] = useState([])

    const toggleModifier = (mod) => {
        setSelectedModifiers(prev =>
            prev.find(m => m.id === mod.id)
                ? prev.filter(m => m.id !== mod.id)
                : [...prev, mod]
        )
    }

    const discountPct = parseInt(product.discount_percent) || 0
    const basePrice = parseFloat(product.price)
    const discountedBase = discountPct > 0 ? basePrice * (1 - discountPct / 100) : basePrice
    const modsPrice = selectedModifiers.reduce((s, m) => s + parseFloat(m.extra_price || 0), 0)
    const total = (discountedBase + modsPrice) * quantity

    const handleAdd = () => {
        addItem(product, selectedModifiers, quantity)
        toast.success(`Agregado al carrito`, {
            icon: '✅',
            style: { borderRadius: '1rem' }
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
            <div
                className="relative bg-white w-full sm:max-w-lg sm:rounded-[2.5rem] rounded-t-[2.5rem] max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-500"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-all">
                    <X className="w-6 h-6" />
                </button>

                {/* Header Image - COMPACT */}
                <div className="relative h-40 sm:h-48 shrink-0 overflow-hidden bg-gray-100">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <UtensilsCrossed className="w-12 h-12 text-gray-200" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>

                    {/* Floating Badges */}
                    <div className="absolute bottom-4 left-6 flex gap-2">
                        {discountPct > 0 && (
                            <span className="px-4 py-1.5 rounded-full text-xs font-black text-white bg-red-500 shadow-xl flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" /> -{discountPct}% OFF
                            </span>
                        )}
                        {product.is_vegan && (
                            <span className="px-4 py-1.5 rounded-full text-xs font-black text-white bg-green-500 shadow-xl flex items-center gap-1.5">
                                <Leaf className="w-3.5 h-3.5" /> VEGANO
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-hide">
                    <div className="pt-2 pb-6">
                        <div className="flex justify-between items-start gap-4 mb-2">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                                    {product.name}
                                </h2>
                                {product.description && (
                                    <p className="text-xs text-gray-500 font-medium leading-relaxed mt-1 line-clamp-2">
                                        {product.description}
                                    </p>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-black" style={{ color: primaryColor }}>${discountedBase.toFixed(0)}</p>
                                {discountPct > 0 && (
                                    <p className="text-xs text-gray-400 font-bold line-through">${basePrice.toFixed(0)}</p>
                                )}
                            </div>
                        </div>

                        {/* Modifier Groups */}
                        {product.modifier_groups?.length > 0 && (
                            <div className="space-y-8">
                                {product.modifier_groups.map(group => {
                                    const isRequired = group.min_selection > 0
                                    return (
                                        <div key={group.id} className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="font-black text-gray-900 text-base">{group.name}</h3>
                                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tighter">
                                                        {isRequired ? 'Elige una opción' : 'Complementos opcionales'}
                                                    </p>
                                                </div>
                                                {isRequired && (
                                                    <span className="px-3 py-1 rounded-full bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-wider border border-red-100">
                                                        Requerido
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {group.modifier_options?.map(opt => {
                                                    const isSelected = selectedModifiers.find(m => m.id === opt.id)

                                                    const handleSelect = () => {
                                                        if (isRequired) {
                                                            // Radio logic: remove others from same group
                                                            setSelectedModifiers(prev => [
                                                                ...prev.filter(m => !group.modifier_options.find(o => o.id === m.id)),
                                                                opt
                                                            ])
                                                        } else {
                                                            // Checkbox logic: toggle
                                                            setSelectedModifiers(prev =>
                                                                prev.find(m => m.id === opt.id)
                                                                    ? prev.filter(m => m.id !== opt.id)
                                                                    : [...prev, opt]
                                                            )
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            onClick={handleSelect}
                                                            className={`w-full flex flex-col items-start p-3 rounded-xl border transition-all duration-200 ${isSelected
                                                                ? 'shadow-sm scale-[0.98]'
                                                                : 'bg-white border-gray-100 hover:border-gray-200'
                                                                }`}
                                                            style={isSelected ? { borderColor: primaryColor, background: '#fff' } : {}}
                                                        >
                                                            <div className="flex items-start justify-between w-full mb-1">
                                                                <span className={`text-[13px] font-bold leading-tight text-left ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{opt.name}</span>
                                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? '' : 'border-gray-200'} ${isRequired ? 'rounded-full' : 'rounded-md'}`} style={isSelected ? { borderColor: primaryColor } : {}}>
                                                                    {isSelected && <div className={`w-2 h-2 ${isRequired ? 'rounded-full' : 'rounded-[2px]'}`} style={{ background: primaryColor }}></div>}
                                                                </div>
                                                            </div>
                                                            {parseFloat(opt.extra_price) > 0 && (
                                                                <span className="text-[11px] font-black" style={{ color: primaryColor }}>+${parseFloat(opt.extra_price).toFixed(0)}</span>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-4 mb-6 justify-between px-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total acumulado</span>
                            <span className="text-3xl font-black text-gray-900">${total.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center gap-5 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm active:scale-90 transition-all border border-gray-100"
                            >
                                <Minus className="w-6 h-6" />
                            </button>
                            <span className="text-2xl font-black text-gray-900 w-6 text-center">{quantity}</span>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-xl active:scale-90 transition-all"
                                style={{ background: primaryColor }}
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleAdd}
                        disabled={product.modifier_groups?.some(g => g.min_selection > 0 && !selectedModifiers.some(sm => g.modifier_options.some(opt => opt.id === sm.id)))}
                        className="w-full py-5 rounded-[2rem] text-white font-black text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl hover:opacity-90 disabled:opacity-50 disabled:grayscale disabled:scale-100"
                        style={{
                            background: primaryColor,
                            boxShadow: `0 12px 24px ${primaryColor}40`
                        }}
                    >
                        <ShoppingBag className="w-6 h-6" />
                        {product.modifier_groups?.some(g => g.min_selection > 0 && !selectedModifiers.some(sm => g.modifier_options.some(opt => opt.id === sm.id)))
                            ? 'Selecciona opciones requeridas'
                            : 'Agregar al pedido'}
                    </button>
                </div>
            </div>
        </div>
    )
}


function CartPanel({ restaurant, primaryColor, onClose, onCheckout }) {
    const { items, getTotal, getItemCount, updateQuantity, removeItem, clearCart } = useCart()

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
            <div
                className="relative bg-white w-full sm:max-w-md sm:rounded-[2.5rem] rounded-t-[2.5rem] max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-500"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b-2 border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Tu Pedido</h2>
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{getItemCount()} artículos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {items.length > 0 && (
                            <button onClick={clearCart} className="text-[11px] text-red-600 font-black uppercase px-4 py-2 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors">Vaciar</button>
                        )}
                        <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                            <X className="w-5 h-5 text-gray-700" />
                        </button>
                    </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar">
                    {items.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-[2rem] flex items-center justify-center">
                                <ShoppingBag className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="text-xl font-black text-gray-900 mb-2">Tu canasta está vacía</p>
                            <p className="text-sm text-gray-500 font-medium px-10">Agrega platillos para comenzar tu pedido</p>
                        </div>
                    ) : (
                        items.map(item => (
                            <div key={item.id} className="bg-gray-50 rounded-2xl p-4 border-2 border-gray-200 hover:border-gray-300 transition-colors group">
                                <div className="flex gap-3 mb-3">
                                    {/* Thumbnail */}
                                    <div className="w-14 h-14 rounded-xl bg-gray-200 shrink-0 overflow-hidden">
                                        {item.product.image_url ? (
                                            <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <UtensilsCrossed className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-gray-900 text-[15px] leading-tight mb-1">{item.product.name}</h3>
                                        {item.modifiers.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {item.modifiers.map((mod, i) => (
                                                    <span key={i} className="text-[9px] font-black uppercase px-2 py-0.5 bg-white rounded-lg text-gray-600 border border-gray-200">
                                                        {mod.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shrink-0 border border-transparent hover:border-red-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Quantity + Price row */}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                    {/* Quantity buttons — high contrast */}
                                    <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-gray-200 p-0.5">
                                        <button
                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-800 rounded-lg transition-colors font-black"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-8 text-center font-black text-gray-900 text-[15px]">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-green-100 hover:text-green-700 text-gray-800 rounded-lg transition-colors font-black"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Subtotal */}
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Subtotal</p>
                                        <span className="font-black text-gray-900 text-lg">${item.subtotal.toFixed(0)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t-2 border-gray-100 p-6 space-y-4 bg-white">
                        <div className="flex items-center justify-between px-1">
                            <div>
                                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Total a pagar</p>
                                <p className="text-4xl font-black text-gray-900 leading-none">${getTotal().toFixed(0)}</p>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-green-100 border-2 border-green-200 flex items-center justify-center">
                                <MessageCircle className="w-7 h-7 text-green-600" />
                            </div>
                        </div>
                        <button
                            onClick={onCheckout}
                            className="w-full py-5 rounded-[2rem] text-white font-black text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl hover:opacity-90"
                            style={{
                                background: '#25D366',
                                boxShadow: '0 12px 24px rgba(37, 211, 102, 0.3)'
                            }}
                        >
                            Confirmar Pedido →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}



// ─── Checkout Flow (Multi-Step: Info → Payment → Review) ──────────────────────
// ─── Checkout Flow (Premium Multi-Step Experience) ───────────────────────────
function CheckoutFlow({ restaurant, primaryColor, secondaryColor, onClose, onBack }) {
    const { items, getTotal, clearCart } = useCart()
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        notes: '',
        orderType: 'pickup',
        paymentMethod: 'cash'
    })
    const [address, setAddress] = useState('')
    const [tableNumber, setTableNumber] = useState('')
    const [locationUrl, setLocationUrl] = useState('')
    const [gettingLocation, setGettingLocation] = useState(false)

    const handleGetLocation = () => {
        if (!navigator.geolocation) { return }
        setGettingLocation(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
                setLocationUrl(mapsUrl)
                setGettingLocation(false)
            },
            (error) => {
                console.error('Location error:', error)
                setGettingLocation(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const handleSubmit = async () => {
        if (!formData.name.trim()) return

        const orderData = {
            restaurant_id: restaurant.restaurant_table_id, // FK to restaurants.id (not profiles.id)
            user_id: restaurant.id,                        // profiles/auth ID for RLS
            guest_id: localStorage.getItem('gc_guest_id'),
            customer_name: formData.name,
            customer_phone: formData.phone,
            order_type: formData.orderType,
            delivery_address: formData.orderType === 'delivery' ? address : (formData.orderType === 'dine_in' ? `Mesa: ${tableNumber}` : null),
            table_number: formData.orderType === 'dine_in' ? tableNumber : null,
            location_url: formData.orderType === 'delivery' ? locationUrl : '',
            payment_method: formData.paymentMethod,
            notes: formData.notes,
            items: items.map(item => ({
                product_id: item.product.id,
                name: item.product.name,
                unit_price: parseFloat(item.product.price),
                price: parseFloat(item.product.price),
                costo: parseFloat(item.product.costo || 0), // Include cost for snapshotting in order-service
                quantity: item.quantity,
                subtotal: item.subtotal,
                modifiers: item.modifiers, // Pass full modifiers array
                product: { // Keep legacy structure just in case, but rely on top-level fields
                    id: item.product.id,
                    name: item.product.name,
                    price: item.product.price,
                    costo: item.product.costo
                }
            })),
            total: getTotal(),
            status: 'pending'
        }

        try {
            await createOrder(orderData)
            const message = generateWhatsAppMessage(
                items,
                restaurant.company_name || 'Restaurante',
                formData.name,
                formData.phone,
                formData.orderType === 'delivery' ? address : (formData.orderType === 'dine_in' ? `Mesa: ${tableNumber}` : null),
                formData.notes,
                formData.paymentMethod,
                formData.orderType === 'delivery' ? locationUrl : ''
            )
            sendWhatsAppOrder(restaurant.phone, message)
            toast.success('¡Pedido enviado con éxito!', { icon: '🚀' })
            clearCart()
            onClose()
        } catch (error) {
            console.error('Error saving order:', error)
            toast.error('Error al procesar pedido')
        }
    }

    const totalSteps = 3

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm"></div>
            <div
                className="relative w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-400 overflow-hidden"
                style={{ background: '#ffffff', colorScheme: 'light' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div style={{ padding: '24px 24px 16px', borderBottom: '2px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <button
                            onClick={step === 1 ? onBack : () => setStep(step - 1)}
                            style={{ width: 40, height: 40, borderRadius: 14, background: '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
                        >
                            <ChevronDown style={{ width: 20, height: 20, color: '#374151', transform: 'rotate(90deg)' }} />
                        </button>
                        <div>
                            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0, lineHeight: 1.2 }}>Finalizar Pedido</h2>
                            <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>PASO {step} DE {totalSteps}</p>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[1, 2, 3].map(s => (
                            <div key={s} style={{ height: 6, flex: 1, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden' }}>
                                <div style={{ height: '100%', transition: 'width 0.5s ease', width: step >= s ? '100%' : '0%', background: primaryColor, borderRadius: 99 }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Scrollable Content ── */}
                <div className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '24px' }}>

                    {/* ── STEP 1 ── */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-in fade-in duration-300">

                            {/* Name field */}
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Tu nombre *</label>
                                <div style={{ position: 'relative' }}>
                                    <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#9ca3af' }} />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="¿A nombre de quién?"
                                        autoFocus
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            paddingLeft: 44, paddingRight: 16, paddingTop: 16, paddingBottom: 16,
                                            borderRadius: 16, border: '2px solid #e5e7eb',
                                            fontSize: 16, color: '#111827', background: '#f9fafb',
                                            outline: 'none', fontFamily: 'inherit'
                                        }}
                                        onFocus={e => { e.target.style.borderColor = primaryColor; e.target.style.background = '#fff' }}
                                        onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
                                    />
                                </div>
                            </div>

                            {/* Order type */}
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>¿Dónde recibes tu pedido?</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                    {[
                                        { value: 'dine_in', label: 'Aquí', sublabel: 'Mesa', icon: '🪑' },
                                        { value: 'pickup', label: 'Recoger', sublabel: 'En local', icon: '🏪' },
                                        { value: 'delivery', label: 'Domicilio', sublabel: 'A casa', icon: '🛵' }
                                    ].map(opt => {
                                        const isSelected = formData.orderType === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => setFormData({ ...formData, orderType: opt.value })}
                                                style={{
                                                    padding: '14px 8px',
                                                    borderRadius: 16,
                                                    border: isSelected ? `2.5px solid ${primaryColor}` : '2px solid #e5e7eb',
                                                    background: isSelected ? '#fff' : '#f9fafb',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                                    cursor: 'pointer',
                                                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                                                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <span style={{ fontSize: 28, lineHeight: 1 }}>{opt.icon}</span>
                                                <span style={{ fontSize: 12, fontWeight: 800, color: isSelected ? '#111827' : '#6b7280', lineHeight: 1.2 }}>{opt.label}</span>
                                                <span style={{ fontSize: 10, color: isSelected ? '#6b7280' : '#9ca3af', lineHeight: 1 }}>{opt.sublabel}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Dine-in: Table */}
                            {formData.orderType === 'dine_in' && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <label style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Número de mesa *</label>
                                    <input
                                        type="text"
                                        value={tableNumber}
                                        onChange={e => setTableNumber(e.target.value)}
                                        placeholder="Ej. 5, 12, Terraza..."
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            padding: '16px 18px', borderRadius: 16,
                                            border: '2px solid #e5e7eb', fontSize: 16,
                                            color: '#111827', background: '#f9fafb', outline: 'none', fontFamily: 'inherit'
                                        }}
                                        onFocus={e => { e.target.style.borderColor = primaryColor; e.target.style.background = '#fff' }}
                                        onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
                                    />
                                </div>
                            )}

                            {/* Delivery: Address + GPS */}
                            {formData.orderType === 'delivery' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="animate-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Dirección exacta</label>
                                        <div style={{ position: 'relative' }}>
                                            <MapPin style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#9ca3af' }} />
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={e => setAddress(e.target.value)}
                                                placeholder="Calle, número, colonia..."
                                                style={{
                                                    width: '100%', boxSizing: 'border-box',
                                                    paddingLeft: 44, paddingRight: 16, paddingTop: 16, paddingBottom: 16,
                                                    borderRadius: 16, border: '2px solid #e5e7eb',
                                                    fontSize: 16, color: '#111827', background: '#f9fafb',
                                                    outline: 'none', fontFamily: 'inherit'
                                                }}
                                                onFocus={e => { e.target.style.borderColor = primaryColor; e.target.style.background = '#fff' }}
                                                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
                                            />
                                        </div>
                                    </div>

                                    {/* GPS Button — redesigned */}
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={gettingLocation}
                                        style={{
                                            width: '100%', padding: '14px 20px',
                                            borderRadius: 16, border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                            background: locationUrl
                                                ? 'linear-gradient(135deg, #059669, #10b981)'
                                                : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                                            color: '#fff', fontWeight: 800, fontSize: 14,
                                            boxShadow: locationUrl
                                                ? '0 4px 14px rgba(5,150,105,0.35)'
                                                : '0 4px 14px rgba(59,130,246,0.35)',
                                            transition: 'all 0.2s', opacity: gettingLocation ? 0.7 : 1
                                        }}
                                    >
                                        {gettingLocation ? (
                                            <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Localizando...</>
                                        ) : locationUrl ? (
                                            <><CheckCircle2 style={{ width: 18, height: 18 }} /> ✓ Ubicación GPS guardada</>
                                        ) : (
                                            <><MapPinned style={{ width: 18, height: 18 }} /> Compartir ubicación GPS</>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Continue button */}
                            <button
                                onClick={() => formData.name.trim() && (formData.orderType !== 'dine_in' || tableNumber.trim()) && setStep(2)}
                                disabled={!formData.name.trim() || (formData.orderType === 'dine_in' && !tableNumber.trim())}
                                style={{
                                    width: '100%', padding: '18px', borderRadius: 18, border: 'none',
                                    background: primaryColor, color: '#fff',
                                    fontSize: 17, fontWeight: 900, cursor: 'pointer',
                                    opacity: (!formData.name.trim() || (formData.orderType === 'dine_in' && !tableNumber.trim())) ? 0.4 : 1,
                                    boxShadow: `0 8px 20px rgba(0,0,0,0.15)`, transition: 'all 0.2s'
                                }}
                            >
                                Continuar →
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: Payment ── */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-in fade-in duration-300">
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 14 }}>¿Cómo deseas pagar?</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[
                                        { value: 'cash', label: 'Efectivo', emoji: '💵', desc: 'Pago al momento de recibir' },
                                        { value: 'transfer', label: 'Transferencia', emoji: '🏦', desc: 'Te compartimos los datos por WhatsApp' },
                                        { value: 'card', label: 'Tarjeta', emoji: '💳', desc: 'Terminal bancaria en local' },
                                    ].map(opt => {
                                        const isSelected = formData.paymentMethod === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => setFormData({ ...formData, paymentMethod: opt.value })}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 16,
                                                    padding: '18px 20px', borderRadius: 18,
                                                    border: isSelected ? `2.5px solid ${primaryColor}` : '2px solid #e5e7eb',
                                                    background: isSelected ? '#fff' : '#f9fafb',
                                                    cursor: 'pointer', textAlign: 'left',
                                                    boxShadow: isSelected ? '0 4px 16px rgba(0,0,0,0.1)' : 'none',
                                                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <span style={{ fontSize: 32 }}>{opt.emoji}</span>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontWeight: 900, color: '#111827', fontSize: 15 }}>{opt.label}</p>
                                                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>{opt.desc}</p>
                                                </div>
                                                <div style={{
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    border: `2.5px solid ${isSelected ? primaryColor : '#d1d5db'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: '#fff', flexShrink: 0
                                                }}>
                                                    {isSelected && <div style={{ width: 10, height: 10, borderRadius: '50%', background: primaryColor }} />}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <button
                                onClick={() => setStep(3)}
                                style={{
                                    width: '100%', padding: '18px', borderRadius: 18, border: 'none',
                                    background: primaryColor, color: '#fff',
                                    fontSize: 17, fontWeight: 900, cursor: 'pointer',
                                    boxShadow: `0 8px 20px rgba(0,0,0,0.15)`, transition: 'all 0.2s'
                                }}
                            >
                                Continuar →
                            </button>
                        </div>
                    )}

                    {/* ── STEP 3: Review & Send ── */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-in fade-in duration-300">
                            {/* Order summary card */}
                            <div style={{ background: '#f9fafb', borderRadius: 20, padding: '20px', border: '2px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {items.map(item => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{
                                                    width: 26, height: 26, borderRadius: 8, background: '#fff',
                                                    border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 900, fontSize: 13, color: '#111827', flexShrink: 0
                                                }}>{item.quantity}</span>
                                                <span style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>{item.product.name}</span>
                                            </div>
                                            <span style={{ fontWeight: 900, color: '#111827', fontSize: 15 }}>${item.subtotal.toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Final</span>
                                    <span style={{ fontSize: 36, fontWeight: 900, color: '#111827', lineHeight: 1 }}>${getTotal().toFixed(0)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>¿Alguna nota extra?</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Sin cebolla, extra salsa, instrucciones especiales..."
                                    rows={3}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        padding: '14px 18px', borderRadius: 16,
                                        border: '2px solid #e5e7eb', fontSize: 15,
                                        color: '#111827', background: '#f9fafb',
                                        outline: 'none', resize: 'none', fontFamily: 'inherit'
                                    }}
                                    onFocus={e => { e.target.style.borderColor = primaryColor; e.target.style.background = '#fff' }}
                                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
                                />
                            </div>

                            {/* Send via WhatsApp */}
                            <button
                                onClick={handleSubmit}
                                style={{
                                    width: '100%', padding: '20px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #128C7E, #25D366)',
                                    color: '#fff', fontSize: 18, fontWeight: 900,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)', transition: 'all 0.2s'
                                }}
                            >
                                <MessageCircle style={{ width: 24, height: 24 }} />
                                Enviar por WhatsApp
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
