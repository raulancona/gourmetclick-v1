import { Edit2, Trash2, Package } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'

export function ProductCard({ product, onEdit, onDelete }) {
    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(price)
    }

    return (
        <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
            {/* Image */}
            <div className="relative aspect-square bg-gray-100 overflow-hidden">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                    </div>
                )}

                {/* Action buttons - visible on hover or always on mobile touch? */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                        className="h-8 w-8 p-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md hover:bg-blue-600 hover:text-white border-border shadow-sm text-blue-600 transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete(product); }}
                        className="h-8 w-8 p-0 bg-red-50 dark:bg-red-950/40 backdrop-blur-md hover:bg-red-600 border-red-200 dark:border-red-900 shadow-sm text-red-600 hover:text-white transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>

            </div>

            {/* Content */}
            <div className="p-4 space-y-2 bg-card">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-foreground line-clamp-1">{product.name}</h3>
                    {product.sku && (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-bold border-muted-foreground/30 text-muted-foreground">
                            {product.sku}
                        </Badge>
                    )}
                </div>

                {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{product.description}</p>
                )}

                <div className="pt-2 flex items-center justify-between">
                    <p className="text-xl font-black text-primary">{formatPrice(product.price)}</p>
                    {!product.is_available && (
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">No disponible</span>
                    )}
                </div>
            </div>

        </Card>
    )
}
