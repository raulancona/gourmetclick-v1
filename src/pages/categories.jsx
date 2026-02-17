import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GripVertical, Edit2, Trash2 } from 'lucide-react'
import { useAuth } from '../features/auth/auth-context'
import { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '../lib/category-service'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { Card } from '../components/ui/card'
import { toast } from 'sonner'

export function CategoriesPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [categoryName, setCategoryName] = useState('')

    // Fetch categories
    const { data: categories = [], isLoading } = useQuery({
        queryKey: ['categories', user?.id],
        queryFn: () => getCategories(user.id),
        enabled: !!user?.id
    })

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (name) => createCategory({ name, order_index: categories.length }, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories'])
            setIsCreateModalOpen(false)
            setCategoryName('')
            toast.success('Categoría creada exitosamente')
        },
        onError: () => toast.error('Error al crear la categoría')
    })

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, name }) => updateCategory(id, { name }, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories'])
            setIsEditModalOpen(false)
            setSelectedCategory(null)
            setCategoryName('')
            toast.success('Categoría actualizada exitosamente')
        },
        onError: () => toast.error('Error al actualizar la categoría')
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => deleteCategory(id, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories'])
            toast.success('Categoría eliminada exitosamente')
        },
        onError: () => toast.error('Error al eliminar la categoría')
    })

    const handleCreate = () => {
        if (!categoryName.trim()) return
        createMutation.mutate(categoryName)
    }

    const handleEdit = (category) => {
        setSelectedCategory(category)
        setCategoryName(category.name)
        setIsEditModalOpen(true)
    }

    const handleUpdate = () => {
        if (!categoryName.trim()) return
        updateMutation.mutate({ id: selectedCategory.id, name: categoryName })
    }

    const handleDelete = (id) => {
        if (confirm('¿Estás seguro de eliminar esta categoría?')) {
            deleteMutation.mutate(id)
        }
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
                        <p className="text-muted-foreground">
                            Organiza tu menú en categorías
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Categoría
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : categories.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No hay categorías
                    </h3>
                    <p className="text-gray-600 mb-6">
                        Crea tu primera categoría para organizar tu menú
                    </p>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Crear Categoría
                    </Button>
                </Card>
            ) : (
                <div className="space-y-3">
                    {categories.map((category) => (
                        <Card key={category.id} className="p-4">
                            <div className="flex items-center gap-4">
                                <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                                <div className="flex-1">
                                    <h3 className="font-medium">{category.name}</h3>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEdit(category)}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDelete(category.id)}
                                        className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false)
                    setCategoryName('')
                }}
                title="Nueva Categoría"
                size="sm"
            >
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="name">Nombre de la categoría</Label>
                        <Input
                            id="name"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder="Ej: Entradas, Platos Fuertes"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsCreateModalOpen(false)
                                setCategoryName('')
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleCreate} disabled={!categoryName.trim()}>
                            Crear
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false)
                    setSelectedCategory(null)
                    setCategoryName('')
                }}
                title="Editar Categoría"
                size="sm"
            >
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="edit-name">Nombre de la categoría</Label>
                        <Input
                            id="edit-name"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsEditModalOpen(false)
                                setSelectedCategory(null)
                                setCategoryName('')
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdate} disabled={!categoryName.trim()}>
                            Actualizar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
