import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GripVertical, Edit2, Trash2 } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTenant } from '../features/auth/tenant-context'
import { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '../lib/category-service'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { Card } from '../components/ui/card'
import { toast } from 'sonner'

function SortableCategoryItem({ category, onEdit, onDelete }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative'
    }

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <Card className={`p-4 ${isDragging ? 'shadow-lg border-primary/50' : ''}`}>
                <div className="flex items-center gap-4">
                    <div {...attributes} {...listeners} className="cursor-move touch-none">
                        <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-medium">{category.name}</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(category)}
                            className="h-8 w-8 p-0"
                        >
                            <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDelete(category.id)}
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export function CategoriesPage() {
    const { tenant } = useTenant()
    const queryClient = useQueryClient()

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [categoryName, setCategoryName] = useState('')

    // Fetch categories
    const { data: categories = [], isLoading } = useQuery({
        queryKey: ['categories', tenant?.id],
        queryFn: () => getCategories(tenant.id),
        enabled: !!tenant?.id
    })

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Reorder mutation
    const reorderMutation = useMutation({
        mutationFn: (newCategories) => reorderCategories(newCategories, tenant.id),
        onSuccess: () => {
            // Invalidate but don't force refetch immediately to prevent jumpiness if we are optimistic
            // actually, better to just let the query update naturally or optimistically update
            // for now, invalidate is safe
            queryClient.invalidateQueries(['categories'])
        },
        onError: () => toast.error('Error al reordenar categorías')
    })

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (name) => createCategory({ name, sort_order: categories.length }, tenant.id),
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
        mutationFn: ({ id, name }) => updateCategory(id, { name }, tenant.id),
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
        mutationFn: (id) => deleteCategory(id, tenant.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories'])
            toast.success('Categoría eliminada exitosamente')
        },
        onError: () => toast.error('Error al eliminar la categoría')
    })

    const handleDragEnd = (event) => {
        const { active, over } = event

        if (active.id !== over.id) {
            const oldIndex = categories.findIndex((cat) => cat.id === active.id)
            const newIndex = categories.findIndex((cat) => cat.id === over.id)

            const newCategories = arrayMove(categories, oldIndex, newIndex)

            // Optimistic update via queryClient would be better, but for now we rely on mutation
            // We should update the cache immediately to prevent flicker
            queryClient.setQueryData(['categories', tenant?.id], newCategories)

            reorderMutation.mutate(newCategories)
        }
    }

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
                            Organiza tu menú en categorías (Arrastra para reordenar)
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
                <div className="max-w-3xl">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={categories.map(c => c.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {categories.map((category) => (
                                    <SortableCategoryItem
                                        key={category.id}
                                        category={category}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
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
