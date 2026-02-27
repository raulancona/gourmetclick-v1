import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import {
    Users, Plus, Trash2, Shield, UserCircle,
    Lock, CheckCircle2, XCircle, Loader2
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from 'sonner'

export function StaffManagement() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const queryClient = useQueryClient()
    const [isAdding, setIsAdding] = useState(false)
    const [formData, setFormData] = useState({ nombre: '', pin: '', rol: 'mesero' })

    const { data: staff = [], isLoading } = useQuery({
        queryKey: ['staff', tenant?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('empleados')
                .select('*')
                .eq('restaurant_id', tenant.id)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        },
        enabled: !!tenant?.id
    })

    const addMutation = useMutation({
        mutationFn: async (newStaff) => {
            const { data, error } = await supabase
                .from('empleados')
                .insert([{
                    ...newStaff,
                    restaurant_id: tenant.id,
                    restaurante_id: user.id // Keeping for legacy RLS if needed, but primary is restaurant_id
                }])
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['staff'])
            setIsAdding(false)
            setFormData({ nombre: '', pin: '', rol: 'mesero' })
            toast.success('Empleado registrado con éxito')
        },
        onError: (err) => {
            if (err.message?.includes('unique')) {
                toast.error('Este PIN ya está en uso')
            } else {
                toast.error('Error al registrar: ' + err.message)
            }
        }
    })

    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, activo }) => {
            const { error } = await supabase
                .from('empleados')
                .update({ activo })
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['staff'])
            toast.success('Estado actualizado')
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (formData.pin.length !== 4 || isNaN(formData.pin)) {
            toast.error('El PIN debe ser de 4 dígitos numéricos')
            return
        }
        addMutation.mutate(formData)
    }

    if (isLoading) return <div className="p-8 text-center animate-pulse">Cargando equipo...</div>

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-foreground">Gestión de Equipo</h2>
                    <p className="text-muted-foreground font-medium">Administra accesos y roles del terminal POS</p>
                </div>
                <Button
                    onClick={() => setIsAdding(!isAdding)}
                    className="rounded-xl font-bold gap-2"
                >
                    {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Agregar Personal</>}
                </Button>
            </div>

            {isAdding && (
                <Card className="border-primary/20 bg-primary/5 p-6 rounded-2xl">
                    <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-6 items-end">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre</Label>
                            <Input
                                placeholder="Ej. Juan Pérez"
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                className="rounded-xl border-primary/20 bg-background h-11 font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">PIN (4 números)</Label>
                            <Input
                                placeholder="1234"
                                maxLength={4}
                                value={formData.pin}
                                onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                className="rounded-xl border-primary/20 bg-background h-11 font-black text-center"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rol</Label>
                            <select
                                value={formData.rol}
                                onChange={e => setFormData({ ...formData, rol: e.target.value })}
                                className="w-full h-11 px-4 rounded-xl border border-primary/20 bg-background font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="mesero">Mesero — Solo POS</option>
                                <option value="cajero">Cajero — POS, Órdenes, Caja</option>
                                <option value="gerente">Gerente — Permisos completos</option>
                                <option value="admin">Admin — Permisos completos</option>
                            </select>
                        </div>
                        <Button
                            type="submit"
                            disabled={addMutation.isPending}
                            className="h-11 rounded-xl font-black"
                        >
                            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
                        </Button>
                    </form>
                </Card>
            )}

            <div className="grid gap-4">
                {staff.map(member => (
                    <Card key={member.id} className="border-border/50 p-4 rounded-2xl flex items-center justify-between hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${member.activo ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                <UserCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground leading-tight">{member.nombre}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${member.rol === 'cajero' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                            : member.rol === 'gerente' || member.rol === 'admin' ? 'bg-primary/10 text-primary'
                                                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                        }`}>
                                        {member.rol === 'gerente' ? '⭐ Gerente' : member.rol === 'admin' ? '🔑 Admin' : member.rol}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono font-bold">PIN: ****</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black text-muted-foreground uppercase">Estado</p>
                                <p className={`text-xs font-bold ${member.activo ? 'text-green-600' : 'text-red-600'}`}>
                                    {member.activo ? 'Activo' : 'Inactivo'}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStatusMutation.mutate({ id: member.id, activo: !member.activo })}
                                className={`rounded-xl h-9 px-4 font-bold border-2 ${member.activo ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-green-50 hover:text-green-600'
                                    }`}
                            >
                                {member.activo ? <><XCircle className="w-4 h-4 mr-2" /> Desactivar</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Activar</>}
                            </Button>
                        </div>
                    </Card>
                ))}
                {staff.length === 0 && !isAdding && (
                    <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-bold text-muted-foreground text-center">No hay personal registrado</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function Card({ children, className }) {
    return <div className={`bg-card rounded-xl border border-border shadow-sm ${className}`}>{children}</div>
}
