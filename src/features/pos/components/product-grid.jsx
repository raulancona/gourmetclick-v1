import { Loader2, Package, Plus } from 'lucide-react'
import { formatCurrency } from '../../../lib/utils'

export function ProductGrid({ products, loading, onProductClick }) {
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => (
                <div
                    key={product.id}
                    onClick={() => onProductClick(product)}
                    className="group bg-card rounded-2xl p-3 shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md transition-all cursor-pointer flex flex-col"
                >
                    <div className="aspect-square rounded-xl bg-muted mb-3 overflow-hidden">
                        {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                                <Package className="w-8 h-8" />
                            </div>
                        )}
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1 leading-snug line-clamp-2">{product.name}</h3>
                    <div className="mt-auto flex items-center justify-between">
                        <span className="font-bold text-foreground">{formatCurrency(product.price)}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onProductClick(product)
                            }}
                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
