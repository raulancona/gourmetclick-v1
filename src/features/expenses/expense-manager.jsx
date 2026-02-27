import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Receipt, ArrowDownCircle, Tag, Loader2, AlertCircle, SlidersHorizontal, CalendarDays, X, TrendingDown, Filter } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { toast } from 'sonner'
import { formatCurrency } from '../../lib/utils'

const CATEGORIES = ['Operación', 'Insumos', 'Nómina', 'Mantenimiento', 'Marketing', 'Otros']

const TIME_PRESETS = [
    { id: 'today', label: 'Hoy' },
    { id: 'yesterday', label: 'Ayer' },
    { id: 'week', label: 'Esta semana' },
    { id: 'month', label: 'Este mes' },
    { id: 'all', label: 'Todo' },
    { id: 'custom', label: 'Personalizado' },
]

function getDateRange(presetId, customStart, customEnd) {
    const now = new Date()
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    switch (presetId) {
        case 'today': return { from: start, to: end }
        case 'yesterday': {
            const ys = new Date(start); ys.setDate(ys.getDate() - 1)
            const ye = new Date(end); ye.setDate(ye.getDate() - 1)
            return { from: ys, to: ye }
        }
        case 'week': {
            const ws = new Date(start); ws.setDate(ws.getDate() - ws.getDay())
            return { from: ws, to: end }
        }
        case 'month':
            return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end }
        case 'custom':
            return {
                from: customStart ? new Date(customStart + 'T00:00:00') : null,
                to: customEnd ? new Date(customEnd + 'T23:59:59') : null,
            }
        default: return { from: null, to: null }
    }
}

const MEDIO_PAGO_OPTIONS = [
    { value: 'cash', label: '💵 Efectivo' },
    { value: 'card', label: '💳 Tarjeta' },
    { value: 'transfer', label: '🏦 Transferencia' },
]

export function ExpenseManager() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const [loading, setLoading] = useState(false)
    const [expenses, setExpenses] = useState([])

    // Form state
    const [formData, setFormData] = useState({
        monto: '', descripcion: '', categoria: 'Operación', medio_pago: 'cash'
    })

    // Filter state
    const [timePreset, setTimePreset] = useState('today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [showCustomPicker, setShowCustomPicker] = useState(false)
    const [filterCategory, setFilterCategory] = useState('all')
    const [filterMedio, setFilterMedio] = useState('all')
    const [showFilters, setShowFilters] = useState(false)

    const restaurantId = tenant?.id

    const { from, to } = getDateRange(timePreset, customStart, customEnd)

    useEffect(() => {
        if (restaurantId) loadExpenses()
    }, [restaurantId, from?.toISOString(), to?.toISOString()])

    const loadExpenses = async () => {
        try {
            setLoading(true)
            let query = supabase
                .from('gastos')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })

            if (from) query = query.gte('created_at', from.toISOString())
            if (to) query = query.lte('created_at', to.toISOString())

            const { data, error } = await query
            if (error) throw error
            setExpenses(data || [])
        } catch (error) {
            toast.error('No se pudieron cargar los gastos')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.monto || parseFloat(formData.monto) <= 0) { toast.error('Ingresa un monto válido'); return }
        if (!restaurantId) { toast.error('Error de sesión'); return }
        try {
            setLoading(true)
            const { data: activeSession } = await supabase
                .from('sesiones_caja').select('id')
                .eq('restaurante_id', restaurantId).eq('estado', 'abierta').maybeSingle()

            if (!activeSession) toast.warning('Registrando gasto sin una sesión de caja activa.')

            const { data, error } = await supabase.from('gastos').insert([{
                monto: parseFloat(formData.monto),
                descripcion: formData.descripcion || null,
                categoria: formData.categoria,
                medio_pago: formData.medio_pago || 'cash',
                restaurant_id: restaurantId,
                sesion_caja_id: activeSession?.id || null,
                empleado_id: user?.id,
                fecha: new Date().toISOString()
            }]).select().single()

            if (error) throw error
            setExpenses(prev => [data, ...prev])
            setFormData({ monto: '', descripcion: '', categoria: 'Operación', medio_pago: 'cash' })
            toast.success('Gasto registrado correctamente')
        } catch (error) {
            toast.error('Error al guardar el gasto')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este gasto?')) return
        try {
            const { error } = await supabase.from('gastos').delete().eq('id', id)
            if (error) throw error
            setExpenses(prev => prev.filter(e => e.id !== id))
            toast.success('Gasto eliminado')
        } catch { toast.error('No se pudo eliminar') }
    }

    // Client-side filtering (category + medio)
    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (filterCategory !== 'all' && e.categoria !== filterCategory) return false
            if (filterMedio !== 'all' && e.medio_pago !== filterMedio) return false
            return true
        })
    }, [expenses, filterCategory, filterMedio])

    const totalFiltered = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.monto || 0), 0)

    // Category breakdown
    const categoryBreakdown = useMemo(() => {
        const acc = {}
        filteredExpenses.forEach(e => {
            acc[e.categoria] = (acc[e.categoria] || 0) + parseFloat(e.monto || 0)
        })
        return Object.entries(acc).sort((a, b) => b[1] - a[1])
    }, [filteredExpenses])

    const activePresetLabel = TIME_PRESETS.find(p => p.id === timePreset)?.label || 'Hoy'
    const hasActiveFilters = filterCategory !== 'all' || filterMedio !== 'all'

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ─── Left: Form ─── */}
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Registrar Gasto</h2>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Salida de efectivo</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="monto">Monto</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                <Input id="monto" type="number" step="0.01" min="0"
                                    value={formData.monto}
                                    onChange={e => setFormData({ ...formData, monto: e.target.value })}
                                    className="pl-8 text-lg font-black" placeholder="0.00" required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría</Label>
                            <select id="categoria" value={formData.categoria}
                                onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none">
                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Input id="descripcion" value={formData.descripcion}
                                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                placeholder="Ej: Compra de hielos, suministros..." />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Medio de Pago</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {MEDIO_PAGO_OPTIONS.map(opt => (
                                    <button key={opt.value} type="button"
                                        onClick={() => setFormData({ ...formData, medio_pago: opt.value })}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${formData.medio_pago === opt.value
                                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'}`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold" disabled={loading}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {loading ? 'Guardando...' : 'Guardar Gasto'}
                        </Button>
                    </form>
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-black uppercase opacity-70 tracking-widest mb-1">{activePresetLabel} · Total</p>
                        <h3 className="text-4xl font-black">{formatCurrency(totalFiltered)}</h3>
                        <div className="flex items-center gap-2 mt-4 text-xs font-bold bg-white/15 w-fit px-3 py-1.5 rounded-full">
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                            {filteredExpenses.length} movimientos
                        </div>
                    </div>
                    <TrendingDown className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
                </div>

                {/* Category Breakdown */}
                {categoryBreakdown.length > 0 && (
                    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                        <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3">Por Categoría</h3>
                        <div className="space-y-2">
                            {categoryBreakdown.map(([cat, total]) => (
                                <div key={cat} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Tag className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-sm font-bold text-foreground">{cat}</span>
                                    </div>
                                    <span className="text-sm font-black text-red-600 dark:text-red-400">{formatCurrency(total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Right: History Table ─── */}
            <div className="lg:col-span-2 space-y-4">
                {/* Filter Bar */}
                <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm space-y-3">
                    {/* Time Presets */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Período:
                        </div>
                        {TIME_PRESETS.map(preset => (
                            <button key={preset.id}
                                onClick={() => {
                                    setTimePreset(preset.id)
                                    setShowCustomPicker(preset.id === 'custom')
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timePreset === preset.id
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                                {preset.id === 'custom' ? <><CalendarDays className="w-3 h-3 inline mr-1" />{preset.label}</> : preset.label}
                            </button>
                        ))}

                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${hasActiveFilters
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>
                            <Filter className="w-3.5 h-3.5" />
                            Filtros {hasActiveFilters && '●'}
                        </button>
                    </div>

                    {/* Custom date picker */}
                    {showCustomPicker && (
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-muted-foreground">Desde:</label>
                                <input type="date" value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-muted-foreground">Hasta:</label>
                                <input type="date" value={customEnd} min={customStart}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                        </div>
                    )}

                    {/* Category + Medio Filters */}
                    {showFilters && (
                        <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Categoría:</label>
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                                    className="h-9 px-3 text-xs font-bold rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary">
                                    <option value="all">Todas</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Pago:</label>
                                <select value={filterMedio} onChange={e => setFilterMedio(e.target.value)}
                                    className="h-9 px-3 text-xs font-bold rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary">
                                    <option value="all">Todos</option>
                                    {MEDIO_PAGO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {hasActiveFilters && (
                                <button onClick={() => { setFilterCategory('all'); setFilterMedio('all') }}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium">
                                    <X className="w-3.5 h-3.5" /> Limpiar filtros
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-foreground">Historial de Gastos</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {filteredExpenses.length} registros · {activePresetLabel}
                                {hasActiveFilters && ' · Con filtros'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-red-600 dark:text-red-400">{formatCurrency(totalFiltered)}</p>
                            <p className="text-xs text-muted-foreground">total del período</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredExpenses.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-bold">Sin gastos en este período</p>
                                <p className="text-sm mt-1 opacity-70">Cambia el período o registra un nuevo gasto</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 border-b border-border">
                                    <tr>
                                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</th>
                                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría</th>
                                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</th>
                                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pago</th>
                                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Monto</th>
                                        <th className="px-5 py-3.5" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredExpenses.map(expense => (
                                        <tr key={expense.id} className="hover:bg-muted/20 transition-colors group">
                                            <td className="px-5 py-3.5">
                                                <p className="text-xs font-bold text-foreground">
                                                    {new Date(expense.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {new Date(expense.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[10px] font-bold uppercase whitespace-nowrap">
                                                    <Tag className="w-3 h-3 text-primary" /> {expense.categoria}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm font-bold text-foreground max-w-[160px] truncate">{expense.descripcion || 'Sin descripción'}</p>
                                                {!expense.sesion_caja_id && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 font-bold uppercase">
                                                        <AlertCircle className="w-2.5 h-2.5" /> Sin Turno
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs font-bold text-muted-foreground">
                                                    {MEDIO_PAGO_OPTIONS.find(o => o.value === expense.medio_pago)?.label || '💵 Efectivo'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="text-base font-black text-red-600 dark:text-red-400">-{formatCurrency(expense.monto)}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <button onClick={() => handleDelete(expense.id)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
