import { useState, useEffect } from 'react'
import { Plus, Trash2, Receipt, ArrowDownCircle, Search, Calendar, Tag, FileText, Loader2, Camera, ExternalLink } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

export function ExpenseManager() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [expenses, setExpenses] = useState([])
    const [formData, setFormData] = useState({
        monto: '',
        descripcion: '',
        categoria: 'Operación'
    })

    const categories = ['Operación', 'Insumos', 'Nómina', 'Mantenimiento', 'Marketing', 'Otros']

    useEffect(() => {
        if (user) loadTodayExpenses()
    }, [user])

    const loadTodayExpenses = async () => {
        try {
            setLoading(true)
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const { data, error } = await supabase
                .from('gastos')
                .select('*')
                .eq('sucursal_id', user.id)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error
            setExpenses(data || [])
        } catch (error) {
            console.error('Error loading expenses:', error)
            toast.error('No se pudieron cargar los gastos')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.monto || parseFloat(formData.monto) <= 0) {
            toast.error('Ingresa un monto válido')
            return
        }

        try {
            setLoading(true)

            // Check for an active session to link this expense
            const { data: activeSession } = await supabase
                .from('sesiones_caja')
                .select('id')
                .eq('restaurante_id', user.id)
                .eq('estado', 'abierta')
                .maybeSingle()

            if (!activeSession) {
                throw new Error('No es posible registrar el gasto: No hay una sesión de caja abierta.')
            }

            let comprobanteUrl = null

            if (formData.file) {
                const fileExt = formData.file.name.split('.').pop()
                const fileName = `${user.id}/${Date.now()}.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('expense-receipts')
                    .upload(fileName, formData.file)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('expense-receipts')
                    .getPublicUrl(fileName)

                comprobanteUrl = publicUrl
            }

            const { data, error } = await supabase
                .from('gastos')
                .insert([{
                    monto: parseFloat(formData.monto),
                    descripcion: formData.descripcion || null,
                    categoria: formData.categoria,
                    sucursal_id: user.id,
                    sesion_caja_id: activeSession.id,
                    comprobante_url: comprobanteUrl
                }])
                .select()
                .single()

            if (error) throw error

            setExpenses([data, ...expenses])
            setFormData({ monto: '', descripcion: '', categoria: 'Operación', file: null })
            // Reset file input manually if needed, or rely on key reset (simple reset here)
            document.getElementById('comprobante').value = ''
            toast.success('Gasto registrado correctamente')
        } catch (error) {
            console.error('Error saving expense:', error)
            toast.error('Error al guardar el gasto')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase.from('gastos').delete().eq('id', id)
            if (error) throw error
            setExpenses(prev => prev.filter(e => e.id !== id))
            toast.success('Gasto eliminado')
        } catch (error) {
            toast.error('No se pudo eliminar el gasto')
        }
    }

    const totalToday = expenses.reduce((sum, e) => sum + parseFloat(e.monto || 0), 0)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Registrar Gasto</h2>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Salida de efectivo del turno</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="monto">Monto</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                <Input
                                    id="monto"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.monto}
                                    onChange={e => setFormData({ ...formData, monto: e.target.value })}
                                    className="pl-8 text-lg font-black"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría</Label>
                            <select
                                id="categoria"
                                value={formData.categoria}
                                onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Input
                                id="descripcion"
                                value={formData.descripcion}
                                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                placeholder="Ej: Compra de hielos, refrescos..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="comprobante">Comprobante (Opcional)</Label>
                            <Input
                                id="comprobante"
                                type="file"
                                accept="image/*"
                                onChange={e => setFormData({ ...formData, file: e.target.files[0] })}
                                className="cursor-pointer"
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold" disabled={loading}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {loading ? 'Guardando...' : 'Guardar Gasto'}
                        </Button>
                    </form>
                </div>

                {/* Summary Card */}
                <div className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-lg shadow-primary/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-black uppercase opacity-60 tracking-widest mb-1">Total hoy</p>
                        <h3 className="text-4xl font-black">${totalToday.toFixed(2)}</h3>
                        <div className="flex items-center gap-2 mt-4 text-xs font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                            {expenses.length} movimientos
                        </div>
                    </div>
                    <Receipt className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
                </div>
            </div>

            {/* Table Section */}
            <div className="lg:col-span-2 space-y-4">
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-muted-foreground" />
                            <h2 className="text-lg font-bold">Gastos de hoy</h2>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Monto</th>
                                    <th className="px-6 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-muted-foreground italic">
                                            No hay gastos registrados hoy
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map(expense => (
                                        <tr key={expense.id} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[10px] font-bold uppercase">
                                                    <Tag className="w-3 h-3 text-primary" />
                                                    {expense.categoria}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-foreground">{expense.descripcion || 'Sin descripción'}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase">
                                                    {new Date(expense.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                {expense.comprobante_url && (
                                                    <a href={expense.comprobante_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline mt-1">
                                                        <ExternalLink className="w-3 h-3" /> Ver Comprobante
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-base font-black text-red-600">-${parseFloat(expense.monto).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
