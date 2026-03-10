import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../features/auth/auth-context'
import { useTenant } from '../features/auth/tenant-context'
import { getGlobalModifierGroups, createModifierGroup, updateModifierGroup, deleteModifierGroup, createModifierOption, updateModifierOption, deleteModifierOption } from '../lib/modifier-service'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { Card } from '../components/ui/card'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

export function ModifiersPage() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const queryClient = useQueryClient()

    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const [selectedGroup, setSelectedGroup] = useState(null)
    const [groupData, setGroupData] = useState({ name: '', min_selection: 0, max_selection: 1 })

    const [isOptionModalOpen, setIsOptionModalOpen] = useState(false)
    const [selectedOption, setSelectedOption] = useState(null)
    const [activeGroupId, setActiveGroupId] = useState(null)
    const [optionData, setOptionData] = useState({ name: '', extra_price: 0 })

    const [expandedGroups, setExpandedGroups] = useState({})

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ['modifiers', tenant?.id],
        queryFn: () => getGlobalModifierGroups(tenant.id),
        enabled: !!tenant?.id
    })

    const toggleGroup = (id) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))
    }

    // Group Mutations
    const saveGroupMutation = useMutation({
        mutationFn: async (data) => {
            if (selectedGroup) {
                // Not implemented deeply in modifier-service yet but we can use supabase directly or add it
                const { error } = await supabase.from('modifier_groups').update({
                    name: data.name, min_selection: data.min_selection, max_selection: data.max_selection
                }).eq('id', selectedGroup.id)
                if (error) throw error
            } else {
                await createModifierGroup(data, tenant.id)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['modifiers'])
            setIsGroupModalOpen(false)
            toast.success(selectedGroup ? 'Grupo actualizado' : 'Grupo creado')
        },
        onError: () => toast.error('Error al guardar el grupo')
    })

    const deleteGroupMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('modifier_groups').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['modifiers'])
            toast.success('Grupo eliminado')
        }
    })

    // Option Mutations
    const saveOptionMutation = useMutation({
        mutationFn: async (data) => {
            if (selectedOption) {
                const { error } = await supabase.from('modifier_options').update({
                    name: data.name, extra_price: data.extra_price
                }).eq('id', selectedOption.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('modifier_options').insert([{
                    group_id: activeGroupId, name: data.name, extra_price: data.extra_price
                }])
                if (error) throw error
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['modifiers'])
            setIsOptionModalOpen(false)
            toast.success(selectedOption ? 'Opción actualizada' : 'Opción agregada')
        },
        onError: () => toast.error('Error al guardar la opción')
    })

    const deleteOptionMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('modifier_options').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['modifiers'])
            toast.success('Opción eliminada')
        }
    })

    // Handlers
    const openGroupModal = (group = null) => {
        setSelectedGroup(group)
        setGroupData(group ? { name: group.name, min_selection: group.min_selection, max_selection: group.max_selection } : { name: '', min_selection: 0, max_selection: 1 })
        setIsGroupModalOpen(true)
    }

    const openOptionModal = (groupId, option = null) => {
        setActiveGroupId(groupId)
        setSelectedOption(option)
        setOptionData(option ? { name: option.name, extra_price: option.extra_price } : { name: '', extra_price: 0 })
        setIsOptionModalOpen(true)
    }

    return (
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Modificadores (Extras)</h1>
                    <p className="text-muted-foreground">Administra grupos de modificadores globales y vincúlalos a tus productos.</p>
                </div>
                <Button onClick={() => openGroupModal()}>
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Grupo
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <Card className="p-12 text-center">
                    <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No tienes grupos de modificadores</h3>
                    <p className="text-muted-foreground mb-6">Crea grupos como "Extras", "Tamaños", "Salsas", etc.</p>
                    <Button onClick={() => openGroupModal()}><Plus className="w-4 h-4 mr-2" /> Crear Primer Grupo</Button>
                </Card>
            ) : (
                <div className="space-y-4 max-w-4xl">
                    {groups.map(group => {
                        const isExpanded = expandedGroups[group.id]
                        return (
                            <Card key={group.id} className="overflow-hidden">
                                <div className="p-4 flex items-center justify-between bg-muted/20 border-b border-border">
                                    <div className="flex items-center gap-3">
                                        <Button variant="ghost" size="icon" onClick={() => toggleGroup(group.id)} className="h-8 w-8">
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </Button>
                                        <div>
                                            <h3 className="font-bold text-lg">{group.name}</h3>
                                            <p className="text-xs text-muted-foreground">Mín: {group.min_selection} | Máx: {group.max_selection}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openOptionModal(group.id)} className="h-8">
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Opción
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => openGroupModal(group)} className="h-8 w-8 text-blue-500 hover:text-blue-700">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Seguro quieres eliminar este grupo?')) deleteGroupMutation.mutate(group.id) }} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="p-4 bg-background">
                                        {group.modifier_options?.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">No hay opciones configuradas. Agrega salsas, tamaños, etc.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {group.modifier_options?.map(opt => (
                                                    <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/5">
                                                        <div>
                                                            <p className="font-bold text-sm">{opt.name}</p>
                                                            <p className="text-xs text-emerald-600 font-medium">{opt.extra_price > 0 ? `+ $${parseFloat(opt.extra_price).toFixed(2)}` : 'Gratis'}</p>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openOptionModal(group.id, opt)}>
                                                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => { if (confirm('¿Eliminar opción?')) deleteOptionMutation.mutate(opt.id) }}>
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        )
                    })}
                </div>
            )}

            <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title={selectedGroup ? "Editar Grupo" : "Nuevo Grupo"} size="sm">
                <div className="space-y-4">
                    <div>
                        <Label>Nombre del Grupo</Label>
                        <Input value={groupData.name} onChange={e => setGroupData({ ...groupData, name: e.target.value })} placeholder="Ej. Elige tu salsa" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Selección Mínima</Label>
                            <Input type="number" min="0" value={groupData.min_selection} onChange={e => setGroupData({ ...groupData, min_selection: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <Label>Selección Máxima</Label>
                            <Input type="number" min="1" value={groupData.max_selection} onChange={e => setGroupData({ ...groupData, max_selection: parseInt(e.target.value) || 1 })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsGroupModalOpen(false)}>Cancelar</Button>
                        <Button disabled={!groupData.name.trim() || saveGroupMutation.isPending} onClick={() => saveGroupMutation.mutate(groupData)}>Guardar</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isOptionModalOpen} onClose={() => setIsOptionModalOpen(false)} title={selectedOption ? "Editar Opción" : "Nueva Opción"} size="sm">
                <div className="space-y-4">
                    <div>
                        <Label>Nombre</Label>
                        <Input value={optionData.name} onChange={e => setOptionData({ ...optionData, name: e.target.value })} placeholder="Ej. Guacamole extra" />
                    </div>
                    <div>
                        <Label>Precio Adicional</Label>
                        <Input type="number" step="0.01" min="0" value={optionData.extra_price} onChange={e => setOptionData({ ...optionData, extra_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsOptionModalOpen(false)}>Cancelar</Button>
                        <Button disabled={!optionData.name.trim() || saveOptionMutation.isPending} onClick={() => saveOptionMutation.mutate(optionData)}>Guardar</Button>
                    </div>
                </div>
            </Modal>

        </div>
    )
}
