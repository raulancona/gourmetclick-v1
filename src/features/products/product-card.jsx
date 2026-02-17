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

                {/* Action buttons - visible on hover */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(product)}
                        className="bg-white/90 backdrop-blur-sm hover:bg-white"
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(product)}
                        className="bg-white/90 backdrop-blur-sm hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                    {product.sku && (
                        <Badge variant="default" className="shrink-0">
                            {product.sku}
                        </Badge>
                    )}
                </div>

                {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                )}

                <div className="pt-2">
                    <p className="text-2xl font-bold text-blue-600">{formatPrice(product.price)}</p>
                </div>
            </div>
        </Card>
    )
}
