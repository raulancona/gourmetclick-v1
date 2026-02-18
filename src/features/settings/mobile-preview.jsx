import { Search, ShoppingBag, Plus, Star, MapPin, Clock, Tag, UtensilsCrossed, ChevronRight } from 'lucide-react'

export function MobilePreview({ settings }) {
    const { primary_color, secondary_color, logo_url, banner_url, layout_type } = settings

    return (
        <div className="relative mx-auto border-[12px] border-gray-900 rounded-[3.5rem] h-[650px] w-[320px] overflow-hidden shadow-2xl bg-white select-none pointer-events-none">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-50 flex items-center justify-center">
                <div className="w-12 h-1 bg-gray-800 rounded-full"></div>
            </div>

            {/* Content Overflow Area */}
            <div className="h-full overflow-y-auto no-scrollbar pb-20">
                {/* Banner */}
                <div className="relative h-44 bg-gray-100 overflow-hidden">
                    {banner_url ? (
                        <img src={banner_url} className="w-full h-full object-cover" alt="Banner" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            <UtensilsCrossed className="w-12 h-12 text-gray-300" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

                    {/* Logo Overlay */}
                    <div className="absolute -bottom-6 left-6 w-16 h-16 rounded-2xl bg-white shadow-xl p-2 border flex items-center justify-center">
                        {logo_url ? (
                            <img src={logo_url} className="w-full h-full object-contain" alt="Logo" />
                        ) : (
                            <span className="text-[10px] font-black text-gray-400">LOGO</span>
                        )}
                    </div>
                </div>

                {/* Info Section */}
                <div className="mt-10 px-6 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="w-32 h-6 bg-gray-200 rounded animate-pulse"></div>
                        <div className="flex gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-[10px] font-bold">4.9 (120+)</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-2 py-1 bg-gray-50 rounded-lg flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-[9px] text-gray-500 font-bold uppercase">15-30 min</span>
                        </div>
                        <div className="px-2 py-1 bg-gray-50 rounded-lg flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-[9px] text-gray-500 font-bold uppercase">2.4 km</span>
                        </div>
                    </div>
                </div>

                {/* Categories Scroll */}
                <div className="mt-6 flex gap-3 px-6 overflow-hidden">
                    {['Favoritos', 'Burgers', 'Snacks', 'Bebidas'].map((cat, i) => (
                        <div
                            key={cat}
                            className="px-4 py-2 rounded-full whitespace-nowrap text-[10px] font-black uppercase transition-colors"
                            style={i === 0 ? { background: primary_color, color: '#fff' } : { background: '#f3f4f6', color: '#9ca3af' }}
                        >
                            {cat}
                        </div>
                    ))}
                </div>

                {/* Products List/Grid */}
                <div className={`mt-6 px-6 ${layout_type === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm ${layout_type === 'list' ? 'flex items-center p-3 gap-3' : 'pb-3'}`}>
                            <div className={`${layout_type === 'grid' ? 'h-32' : 'w-20 h-20'} bg-gray-50 shrink-0 relative flex items-center justify-center rounded-2xl overflow-hidden`}>
                                <UtensilsCrossed className="w-6 h-6 text-gray-200" />
                                {i === 1 && (
                                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-500 text-[8px] font-black text-white">
                                        -20%
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 px-2 mt-2">
                                <div className="h-3 w-3/4 bg-gray-200 rounded mb-1 animate-pulse"></div>
                                <div className="h-2 w-full bg-gray-100 rounded mb-2 animate-pulse"></div>
                                <div className="flex items-center justify-between">
                                    <span className="font-black text-sm" style={{ color: primary_color }}>$120</span>
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg"
                                        style={{ background: primary_color }}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Nav Simulation */}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-white/80 backdrop-blur-md border-t flex items-center justify-center px-6">
                <div
                    className="w-full h-11 rounded-2xl flex items-center justify-between px-5 text-white shadow-xl"
                    style={{ background: '#25D366' }}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Ver Pedido</span>
                    </div>
                    <span className="text-xs font-black">$480</span>
                </div>
            </div>
        </div>
    )
}
