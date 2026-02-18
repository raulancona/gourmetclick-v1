import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Upload, Search, Trash2, Images } from 'lucide-react'
import { useAuth } from '../features/auth/auth-context'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/product-service'
import { deleteProductImage } from '../lib/image-service'
import { ProductCard } from '../features/products/product-card'
import { ProductForm } from '../features/products/product-form'
import { CSVUpload } from '../features/products/csv-upload'
import { BulkImageUpload } from '../features/dashboard/BulkImageUpload'
import { Modal } from '../components/ui/modal'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { toast } from 'sonner'


export function ProductsPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    // State
    const [searchQuery, setSearchQuery] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isCSVModalOpen, setIsCSVModalOpen] = useState(false)
    const [isBulkImageModalOpen, setIsBulkImageModalOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)


    // Fetch products
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products', user?.id],
        queryFn: () => getProducts(user.id),
        enabled: !!user?.id
    })

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (productData) => createProduct(productData, user.id),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['products'])
            setIsCreateModalOpen(false)
            toast.success('Producto creado exitosamente')
            return data
        },
        onError: (error) => {
            toast.error(error.message || 'Error al crear el producto')
        }
    })

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateProduct(id, data, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['products'])
            setIsEditModalOpen(false)
            setSelectedProduct(null)
            toast.success('Producto actualizado exitosamente')
        },
        onError: (error) => {
            toast.error(error.message || 'Error al actualizar el producto')
        }
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (product) => {
            // Delete image if exists
            if (product.image_url) {
                await deleteProductImage(product.image_url)
            }
            await deleteProduct(product.id, user.id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['products'])
            setIsDeleteDialogOpen(false)
            setSelectedProduct(null)
            toast.success('Producto eliminado exitosamente')
        },
        onError: (error) => {
            toast.error(error.message || 'Error al eliminar el producto')
        }
    })

    // CSV import handler - CSV component handles DB ops internally
    const handleCSVImportComplete = () => {
        queryClient.invalidateQueries(['products'])
        queryClient.invalidateQueries(['categories'])
        setIsCSVModalOpen(false)
    }

    // Filter products by search query
    const filteredProducts = products.filter(product => {
        const query = searchQuery.toLowerCase()
        return (
            product.name.toLowerCase().includes(query) ||
            product.description?.toLowerCase().includes(query) ||
            product.sku?.toLowerCase().includes(query)
        )
    })

    // Handlers
    const handleEdit = (product) => {
        setSelectedProduct(product)
        setIsEditModalOpen(true)
    }

    const handleDelete = (product) => {
        setSelectedProduct(product)
        setIsDeleteDialogOpen(true)
    }

    const handleCreateSubmit = async (data) => {
        await createMutation.mutateAsync(data)
    }

    const handleUpdateSubmit = async (data) => {
        await updateMutation.mutateAsync({ id: selectedProduct.id, data })
    }



    const handleConfirmDelete = async () => {
        await deleteMutation.mutateAsync(selectedProduct)
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
                        <p className="text-muted-foreground">
                            Gestiona tu catálogo de productos
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsBulkImageModalOpen(true)}
                            className="hidden md:flex"
                        >
                            <Images className="w-4 h-4 mr-2" />
                            Carga Masiva de Fotos
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsCSVModalOpen(true)}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Importar CSV
                        </Button>
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Producto
                        </Button>
                    </div>

                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Buscar productos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Products Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Cargando productos...</p>
                    </div>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {searchQuery ? 'No se encontraron productos' : 'No hay productos'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                        {searchQuery
                            ? 'Intenta con otro término de búsqueda'
                            : 'Comienza agregando tu primer producto o importa un catálogo CSV'}
                    </p>
                    {!searchQuery && (
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => setIsCSVModalOpen(true)}>
                                <Upload className="w-4 h-4 mr-2" />
                                Importar CSV
                            </Button>
                            <Button onClick={() => setIsCreateModalOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Producto
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Create Product Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Nuevo Producto"
                size="md"
            >
                <ProductForm
                    onSubmit={handleCreateSubmit}
                    onCancel={() => setIsCreateModalOpen(false)}
                    isLoading={createMutation.isPending}
                />
            </Modal>

            {/* Edit Product Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false)
                    setSelectedProduct(null)
                }}
                title="Editar Producto"
                size="md"
            >
                <ProductForm
                    product={selectedProduct}
                    onSubmit={handleUpdateSubmit}
                    onCancel={() => {
                        setIsEditModalOpen(false)
                        setSelectedProduct(null)
                    }}
                    isLoading={updateMutation.isPending}
                />
            </Modal>

            {/* CSV Import Modal */}
            <Modal
                isOpen={isCSVModalOpen}
                onClose={() => setIsCSVModalOpen(false)}
                title="Importar Productos desde CSV"
                size="lg"
            >
                <CSVUpload
                    onImport={handleCSVImportComplete}
                    onCancel={() => setIsCSVModalOpen(false)}
                />
            </Modal>

            {/* Bulk Image Upload Modal */}
            <Modal
                isOpen={isBulkImageModalOpen}
                onClose={() => setIsBulkImageModalOpen(false)}
                title="Carga Masiva de Fotos"
                size="lg"
            >
                <div className="p-4">
                    <BulkImageUpload />
                    <div className="mt-6 flex justify-end">
                        <Button variant="outline" onClick={() => setIsBulkImageModalOpen(false)}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </Modal>


            {/* Delete Confirmation Dialog */}
            <Modal
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false)
                    setSelectedProduct(null)
                }}
                title="Eliminar Producto"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        ¿Estás seguro de que deseas eliminar <strong>{selectedProduct?.name}</strong>?
                        Esta acción no se puede deshacer.
                    </p>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteDialogOpen(false)
                                setSelectedProduct(null)
                            }}
                            disabled={deleteMutation.isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleConfirmDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-red-50 text-red-600 border-red-300 hover:bg-red-100"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
