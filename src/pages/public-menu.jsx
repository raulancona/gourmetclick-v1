import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Search, ShoppingBag, X, Plus, Minus, Trash2, Send, MapPin, Clock, Star, ChevronDown, User, Phone, MessageCircle, CreditCard, Banknote, Building2, MapPinned, Loader2, Leaf } from 'lucide-react'
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

    const addItem = (product, modifiers = [], quantity = 1) => {
        const basePrice = parseFloat(product.price)
        const modsTotal = modifiers.reduce((s, m) => s + parseFloat(m.extra_price || 0), 0)
        // Apply discount
        const discountPct = parseInt(product.discount_percent) || 0
        const discountedBase = discountPct > 0 ? basePrice * (1 - discountPct / 100) : basePrice
        setItems(prev => [...prev, {
            id: Date.now() + Math.random(),
            product, modifiers, quantity,
            subtotal: (discountedBase + modsTotal) * quantity
        }])
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
    }, [slug])

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
    )
}

// ─── Promo Popup ──────────────────────────────────────────────────────────────
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
        <div className="min-h-screen" style={{ background: '#FAFAFA' }}>
            {/* ─── Hero Header ───────────────────────────────────── */}
            <header className="relative overflow-hidden" style={{ background: `linear - gradient(135deg, ${primaryColor}dd 0 %, ${primaryColor} 50 %, ${primaryColor}bb 100 %)` }}>
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
                <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
                    <div className="max-w-lg mx-auto">
                        <div ref={categoryScrollRef} className="flex gap-1 px-4 py-3 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                                style={selectedCategory === 'all'
                                    ? { background: primaryColor, color: '#fff' }
                                    : { background: '#f3f4f6', color: '#6b7280' }
                                }
                            >
                                Todos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                                    style={selectedCategory === cat.id
                                        ? { background: primaryColor, color: '#fff' }
                                        : { background: '#f3f4f6', color: '#6b7280' }
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

            <style>{`.no - scrollbar:: -webkit - scrollbar{ display: none }.no - scrollbar{ -ms - overflow - style: none; scrollbar - width: none } `}</style>
        </div>
    )
}

// ─── Product Card (with badges + discount) ────────────────────────────────────
function ProductCard({ product, primaryColor, secondaryColor, onClick }) {
    const { addItem } = useCart()
    const discountPct = parseInt(product.discount_percent) || 0
    const originalPrice = parseFloat(product.price)
    const finalPrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice

    const handleQuickAdd = (e) => {
        e.stopPropagation()
        addItem(product)
    }

    return (
        <div onClick={onClick} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex group border border-gray-100 relative">
            {/* Badges */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                {discountPct > 0 && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-sm" style={{ background: '#EF4444' }}>
                        -{discountPct}%
                    </span>
                )}
                {product.is_vegan && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-sm bg-green-500 flex items-center gap-0.5">
                        <Leaf className="w-2.5 h-2.5" /> Vegano
                    </span>
                )}
                {product.badge_text && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-sm" style={{ background: secondaryColor }}>
                        {product.badge_text}
                    </span>
                )}
            </div>

            {/* Image */}
            <div className="w-28 h-28 flex-shrink-0 overflow-hidden bg-gray-50">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-200" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
                <div>
                    <h3 className="font-bold text-gray-900 text-[15px] leading-tight truncate">{product.name}</h3>
                    {product.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                        {discountPct > 0 ? (
                            <>
                                <span className="text-sm line-through text-gray-400">${originalPrice.toFixed(2)}</span>
                                <span className="text-lg font-black" style={{ color: '#EF4444' }}>${finalPrice.toFixed(2)}</span>
                            </>
                        ) : (
                            <span className="text-lg font-black" style={{ color: primaryColor }}>${originalPrice.toFixed(2)}</span>
                        )}
                    </div>
                    <button
                        onClick={handleQuickAdd}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all active:scale-90"
                        style={{ background: primaryColor }}
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Product Modal ────────────────────────────────────────────────────────────
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
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Image */}
                {product.image_url && (
                    <div className="h-56 overflow-hidden relative">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                        {/* Badges on image */}
                        <div className="absolute bottom-3 left-3 flex gap-1.5">
                            {discountPct > 0 && <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white bg-red-500">-{discountPct}%</span>}
                            {product.is_vegan && <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white bg-green-500 flex items-center gap-1"><Leaf className="w-3 h-3" />Vegano</span>}
                            {product.badge_text && <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white" style={{ background: secondaryColor }}>{product.badge_text}</span>}
                        </div>
                    </div>
                )}

                <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex-1 overflow-y-auto p-5">
                    <h2 className="text-xl font-black text-gray-900 mb-1">{product.name}</h2>
                    {product.description && (
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">{product.description}</p>
                    )}

                    {/* Price with discount */}
                    <div className="mb-5">
                        {discountPct > 0 ? (
                            <div className="flex items-center gap-3">
                                <span className="text-lg line-through text-gray-400">${basePrice.toFixed(2)}</span>
                                <span className="text-2xl font-black text-red-500">${discountedBase.toFixed(2)}</span>
                                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-red-50 text-red-600">Ahorras ${(basePrice - discountedBase).toFixed(2)}</span>
                            </div>
                        ) : (
                            <p className="text-2xl font-black" style={{ color: primaryColor }}>${basePrice.toFixed(2)}</p>
                        )}
                    </div>

                    {/* Badges row (if no image) */}
                    {!product.image_url && (product.is_vegan || product.badge_text) && (
                        <div className="flex gap-1.5 mb-4">
                            {product.is_vegan && <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-green-700 bg-green-50 flex items-center gap-1"><Leaf className="w-3 h-3" />Vegano</span>}
                            {product.badge_text && <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white" style={{ background: secondaryColor }}>{product.badge_text}</span>}
                        </div>
                    )}

                    {/* Modifier Groups */}
                    {product.modifier_groups?.map(group => (
                        <div key={group.id} className="mb-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-900 text-sm">{group.name}</h3>
                                {group.min_selection > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Requerido</span>
                                )}
                            </div>
                            <div className="space-y-2">
                                {group.modifier_options?.map(opt => {
                                    const isSelected = selectedModifiers.find(m => m.id === opt.id)
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => toggleModifier(opt)}
                                            className={`w - full flex items - center justify - between p - 3 rounded - xl border - 2 transition - all text - left ${isSelected ? 'border-current bg-orange-50' : 'border-gray-100 hover:border-gray-200'} `}
                                            style={isSelected ? { borderColor: primaryColor, color: primaryColor } : {}}
                                        >
                                            <span className="text-sm font-medium text-gray-800">{opt.name}</span>
                                            {parseFloat(opt.extra_price) > 0 && (
                                                <span className="text-sm font-semibold" style={{ color: primaryColor }}>+${parseFloat(opt.extra_price).toFixed(2)}</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Quantity */}
                    <div className="flex items-center justify-center gap-6 py-4">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 active:scale-90 transition-all">
                            <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-xl font-black text-gray-900 w-8 text-center">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white active:scale-90 transition-all" style={{ background: primaryColor }}>
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-white">
                    <button
                        onClick={handleAdd}
                        className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        style={{ background: primaryColor }}
                    >
                        Agregar al pedido · ${total.toFixed(2)}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────
function CartPanel({ restaurant, primaryColor, onClose, onCheckout }) {
    const { items, getTotal, getItemCount, updateQuantity, removeItem, clearCart } = useCart()

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">Tu Pedido</h2>
                        <p className="text-sm text-gray-500">{getItemCount()} artículos</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {items.length > 0 && (
                            <button onClick={clearCart} className="text-xs text-red-500 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Vaciar</button>
                        )}
                        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {items.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingBag className="w-14 h-14 mx-auto mb-3 text-gray-200" />
                            <p className="text-gray-500 font-medium">Tu canasta está vacía</p>
                            <p className="text-sm text-gray-400 mt-1">Agrega platillos deliciosos</p>
                        </div>
                    ) : (
                        items.map(item => (
                            <div key={item.id} className="bg-gray-50 rounded-2xl p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 text-[15px]">{item.product.name}</h3>
                                        {item.modifiers.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {item.modifiers.map((mod, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 bg-white rounded-full text-gray-600 border border-gray-200">
                                                        {mod.name}{parseFloat(mod.extra_price) > 0 && ` + $${parseFloat(mod.extra_price).toFixed(2)} `}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200">
                                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center">
                                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                                        </button>
                                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center">
                                            <Plus className="w-3.5 h-3.5 text-gray-600" />
                                        </button>
                                    </div>
                                    <span className="font-black text-gray-900">${item.subtotal.toFixed(2)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {items.length > 0 && (
                    <div className="border-t border-gray-100 p-5 space-y-4 bg-white">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600 font-medium">Total</span>
                            <span className="text-2xl font-black text-gray-900">${getTotal().toFixed(2)}</span>
                        </div>
                        <button
                            onClick={onCheckout}
                            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                            style={{ background: '#25D366' }}
                        >
                            <MessageCircle className="w-5 h-5" />
                            Continuar por WhatsApp
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Checkout Flow (Multi-Step: Info → Payment → Review) ──────────────────────
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
            user_id: restaurant.id, // The owner of the restaurant
            customer_name: formData.name,
            customer_phone: formData.phone,
            order_type: formData.orderType,
            delivery_address: formData.orderType === 'delivery' ? address : (formData.orderType === 'dine_in' ? `Mesa: ${tableNumber}` : null),
            table_number: formData.orderType === 'dine_in' ? tableNumber : null,
            location_url: formData.orderType === 'delivery' ? locationUrl : '',
            payment_method: formData.paymentMethod,
            notes: formData.notes,
            items: items.map(item => ({
                product: { name: item.product.name },
                quantity: item.quantity,
                subtotal: item.subtotal,
                modifiers: item.modifiers.map(m => ({ name: m.name }))
            })),
            total: getTotal(),
            status: 'pending'
        }

        try {
            // Save to DB
            await createOrder(orderData)

            // Send WhatsApp
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

            toast.success('¡Pedido enviado con éxito!')
            clearCart()
            onClose()
        } catch (error) {
            console.error('Error saving order:', error)
            toast.error('Hubo un problema al procesar tu pedido. Intenta de nuevo.')
        }
    }

    const totalSteps = 3

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Progress */}
                <div className="px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={step === 1 ? onBack : () => setStep(step - 1)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <ChevronDown className="w-5 h-5 text-gray-600 rotate-90" />
                        </button>
                        <h2 className="text-lg font-black text-gray-900 flex-1">Finalizar Pedido</h2>
                        <span className="text-sm text-gray-400">Paso {step}/{totalSteps}</span>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="h-1 flex-1 rounded-full" style={{ background: step >= s ? primaryColor : '#e5e7eb' }}></div>
                        ))}
                    </div>
                </div>

                {/* Step 1: User Info + Order Type */}
                {step === 1 && (
                    <div className="px-5 pb-5 space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">
                                <User className="w-4 h-4 inline mr-1.5" />
                                Tu nombre *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="¿Cómo te llamas?"
                                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:border-current focus:outline-none text-[15px] transition-colors"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">
                                <Phone className="w-4 h-4 inline mr-1.5" />
                                Tu teléfono (opcional)
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="55 1234 5678"
                                className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:border-current focus:outline-none text-[15px] transition-colors"
                            />
                        </div>

                        {/* Order Type */}
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">Tipo de pedido</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'pickup', label: '🏪 Recoger', desc: 'Para llevar' },
                                    { value: 'delivery', label: '🛵 Envío', desc: 'A domicilio' },
                                    { value: 'dine_in', label: '🪑 Aquí', desc: 'Comer aquí' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFormData({ ...formData, orderType: opt.value })}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all ${formData.orderType === opt.value ? 'bg-orange-50' : 'border-gray-200'}`}
                                        style={formData.orderType === opt.value ? { borderColor: primaryColor } : {}}
                                    >
                                        <span className="text-sm font-bold block">{opt.label}</span>
                                        <span className="text-[10px] text-gray-500">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {formData.orderType === 'dine_in' && (
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-2">
                                    Número de mesa *
                                </label>
                                <input
                                    type="text"
                                    value={tableNumber}
                                    onChange={e => setTableNumber(e.target.value)}
                                    placeholder="Ej. 5, 12, VIP..."
                                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:border-current focus:outline-none text-[15px] transition-colors"
                                />
                            </div>
                        )}

                        {formData.orderType === 'delivery' && (
                            <>
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                                        <MapPin className="w-4 h-4 inline mr-1.5" />
                                        Dirección de entrega
                                    </label>
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                        placeholder="Calle, número, colonia..."
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:border-current focus:outline-none text-[15px] transition-colors"
                                    />
                                </div>

                                {/* Location sharing */}
                                <button
                                    type="button"
                                    onClick={handleGetLocation}
                                    disabled={gettingLocation}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
                                >
                                    {gettingLocation ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Obteniendo ubicación...</>
                                    ) : locationUrl ? (
                                        <><MapPinned className="w-4 h-4 text-green-600" /> <span className="text-green-600">📍 Ubicación compartida</span></>
                                    ) : (
                                        <><MapPinned className="w-4 h-4" /> 📍 Compartir mi ubicación</>
                                    )}
                                </button>
                                {locationUrl && (
                                    <p className="text-xs text-green-600 text-center -mt-2">
                                        Se enviará un link de Google Maps al restaurante
                                    </p>
                                )}
                            </>
                        )}

                        <button
                            onClick={() => formData.name.trim() && (formData.orderType !== 'dine_in' || tableNumber.trim()) && setStep(2)}
                            disabled={!formData.name.trim() || (formData.orderType === 'dine_in' && !tableNumber.trim())}
                            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-all"
                            style={{ background: primaryColor }}
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {/* Step 2: Payment Method */}
                {step === 2 && (
                    <div className="px-5 pb-5 space-y-4">
                        <label className="text-sm font-semibold text-gray-700 block mb-1">¿Cómo deseas pagar?</label>

                        <div className="space-y-3">
                            {[
                                { value: 'cash', icon: Banknote, label: 'Efectivo', desc: 'Pago en efectivo al recibir', emoji: '💵' },
                                { value: 'transfer', icon: Building2, label: 'Transferencia', desc: 'Transferencia bancaria', emoji: '🏦' },
                                { value: 'card', icon: CreditCard, label: 'Tarjeta (terminal)', desc: 'Pago con tarjeta al recibir', emoji: '💳' },
                            ].map(opt => {
                                const isSelected = formData.paymentMethod === opt.value
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFormData({ ...formData, paymentMethod: opt.value })}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isSelected ? 'shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                                        style={isSelected ? { borderColor: primaryColor, background: `${primaryColor}08` } : {}}
                                    >
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                                            style={isSelected ? { background: `${primaryColor}15` } : { background: '#f3f4f6' }}
                                        >
                                            {opt.emoji}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-900 text-[15px]">{opt.label}</p>
                                            <p className="text-xs text-gray-500">{opt.desc}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? '' : 'border-gray-300'}`} style={isSelected ? { borderColor: primaryColor } : {}}>
                                            {isSelected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: primaryColor }}></div>}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        <button
                            onClick={() => setStep(3)}
                            className="w-full py-4 rounded-2xl text-white font-bold text-base active:scale-[0.98] transition-all"
                            style={{ background: primaryColor }}
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {/* Step 3: Review & Notes */}
                {step === 3 && (
                    <div className="px-5 pb-5 space-y-4">
                        {/* Order Summary */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-2 max-h-48 overflow-y-auto">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{item.quantity}x {item.product.name}</span>
                                    <span className="font-bold text-gray-900">${item.subtotal.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                                <span>Total</span>
                                <span className="text-lg">${getTotal().toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Customer info summary */}
                        <div className="bg-blue-50 rounded-2xl p-4 space-y-1">
                            <p className="text-sm text-blue-900"><strong>Nombre:</strong> {formData.name}</p>
                            {formData.phone && <p className="text-sm text-blue-900"><strong>Tel:</strong> {formData.phone}</p>}
                            <p className="text-sm text-blue-900"><strong>Tipo:</strong> {formData.orderType === 'pickup' ? '🏪 Recoger' : '🛵 A domicilio'}</p>
                            {address && <p className="text-sm text-blue-900"><strong>Dir:</strong> {address}</p>}
                            {locationUrl && <p className="text-sm text-blue-900"><strong>📍</strong> Ubicación compartida</p>}
                            <p className="text-sm text-blue-900"><strong>Pago:</strong> {formData.paymentMethod === 'cash' ? '💵 Efectivo' : formData.paymentMethod === 'transfer' ? '🏦 Transferencia' : '💳 Tarjeta'}</p>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">Notas adicionales (opcional)</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Sin cebolla, extra picante, etc..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-current focus:outline-none text-[15px] resize-none transition-colors"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-2xl font-bold text-gray-600 bg-gray-100 active:scale-[0.98] transition-all">
                                Atrás
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-[2] py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                style={{ background: '#25D366' }}
                            >
                                <Send className="w-5 h-5" />
                                Enviar por WhatsApp
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
