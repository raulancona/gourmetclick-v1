import { useMemo, useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../features/auth/tenant-context'
import { useAuth } from '../features/auth/auth-context'
import { useTerminal } from '../features/auth/terminal-context'
import { supabase } from '../lib/supabase'
import {
    Search, Package, Clock, ChefHat, CheckCircle2, XCircle,
    RefreshCw, Lock, CreditCard, Wifi, WifiOff, Flame, Archive,
    AlertTriangle, ChevronLeft, ChevronRight, Calendar, CalendarDays,
    CheckSquare, Square, Trash2, ChevronDown, X, SlidersHorizontal
} from 'lucide-react'
import { KpiDrilldownModal } from '../components/kpi-drilldown-modal'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { toast } from 'sonner'
import {
    getOrders, updateOrderStatus, updateOrder, deleteOrder, reopenOrder,
    getOrderStats, ORDER_STATUSES, PAYMENT_METHODS, getNextStatuses
} from '../lib/order-service'
import { OrderDetailModal } from '../features/orders/order-detail-modal'
import { formatCurrency } from '../lib/utils'

// ─── Time Filter Presets ──────────────────────────────────────────────────────
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
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    switch (presetId) {
        case 'today':
            return { startDate: todayStart.toISOString(), endDate: todayEnd.toISOString() }
        case 'yesterday': {
            const ys = new Date(todayStart); ys.setDate(ys.getDate() - 1)
            const ye = new Date(todayEnd); ye.setDate(ye.getDate() - 1)
            return { startDate: ys.toISOString(), endDate: ye.toISOString() }
        }
        case 'week': {
            const ws = new Date(todayStart); ws.setDate(ws.getDate() - ws.getDay())
            return { startDate: ws.toISOString(), endDate: todayEnd.toISOString() }
        }
        case 'month': {
            const ms = new Date(now.getFullYear(), now.getMonth(), 1)
            return { startDate: ms.toISOString(), endDate: todayEnd.toISOString() }
        }
        case 'custom':
            return {
                startDate: customStart ? new Date(customStart + 'T00:00:00').toISOString() : null,
                endDate: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : null,
            }
        default: // 'all'
            return { startDate: null, endDate: null }
    }
}

export function OrdersPage() {
    const { tenant } = useTenant()
    const { user } = useAuth()
    const { activeEmployee } = useTerminal()
    const queryClient = useQueryClient()

    // UI State
    const [activeTab, setActiveTab] = useState('activas')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedKpi, setSelectedKpi] = useState(null)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [isConnected, setIsConnected] = useState(true)
    const [historyPage, setHistoryPage] = useState(1)

    // Time filter state
    const [timePreset, setTimePreset] = useState('all')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [showCustomPicker, setShowCustomPicker] = useState(false)

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [showBulkBar, setShowBulkBar] = useState(false)
    const [bulkStatus, setBulkStatus] = useState('')

    const restaurantId = tenant?.id || user?.id

    const { startDate, endDate } = getDateRange(timePreset, customStart, customEnd)

    // ─── Queries ────────────────────────────────────────────────────────────
    const activeQueryKey = ['orders-active', restaurantId, startDate, endDate]
    const cajaQueryKey = ['orders-caja', restaurantId, startDate, endDate]
    const historyQueryKey = ['orders-history', restaurantId, historyPage, startDate, endDate]

    const { data: activeOrdersRaw, isLoading: isLoadingActive, refetch: refetchActive } = useQuery({
        queryKey: activeQueryKey,
        queryFn: () => getOrders(restaurantId, { mode: 'active', pageSize: 500, startDate, endDate }),
        enabled: !!restaurantId,
        refetchInterval: 8_000,
    })

    const { data: cajaOrdersRaw, isLoading: isLoadingCaja, refetch: refetchCaja } = useQuery({
        queryKey: cajaQueryKey,
        queryFn: () => getOrders(restaurantId, { mode: 'caja', pageSize: 500, startDate, endDate }),
        enabled: !!restaurantId && activeTab === 'caja',
        refetchInterval: 15_000,
    })

    const { data: historyOrdersRaw, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: historyQueryKey,
        queryFn: () => getOrders(restaurantId, { mode: 'historial', page: historyPage, pageSize: 50, startDate, endDate }),
        enabled: !!restaurantId && activeTab === 'historial',
        refetchInterval: 30_000,
    })

    const allOrders = activeTab === 'activas'
        ? (activeOrdersRaw?.data || [])
        : activeTab === 'caja'
            ? (cajaOrdersRaw?.data || [])
            : (historyOrdersRaw?.data || [])
    const totalHistoryCount = historyOrdersRaw?.count || 0
    const isLoading = activeTab === 'activas' ? isLoadingActive : activeTab === 'caja' ? isLoadingCaja : isLoadingHistory

    const refetchAll = () => { refetchActive(); refetchCaja(); refetchHistory() }

    // ─── Stats Query ─────────────────────────────────────────────────────────
    const { data: stats } = useQuery({
        queryKey: ['order-stats-live', restaurantId],
        queryFn: () => getOrderStats(restaurantId),
        enabled: !!restaurantId,
        refetchInterval: 10_000,
    })

    // ─── Realtime ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!restaurantId) return
        const channel = supabase
            .channel(`orders-live-${restaurantId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                const orderId = payload.new?.restaurant_id || payload.old?.restaurant_id
                if (orderId && orderId !== restaurantId) return
                queryClient.invalidateQueries({ queryKey: ['orders-active', restaurantId] })
                queryClient.invalidateQueries({ queryKey: ['orders-caja', restaurantId] })
                queryClient.invalidateQueries({ queryKey: ['orders-history', restaurantId] })
                queryClient.invalidateQueries({ queryKey: ['order-stats-live', restaurantId] })
                if (payload.eventType === 'INSERT') {
                    try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { }) } catch { }
                    toast.success(`🔔 ¡Nueva orden! ${payload.new?.customer_name || 'Cliente General'}`, { duration: 6000 })
                }
            })
            .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'))
        return () => supabase.removeChannel(channel)
    }, [restaurantId, queryClient])

    // ─── Filtered Orders ──────────────────────────────────────────────────────
    const filteredOrders = useMemo(() => {
        if (!searchTerm) return allOrders
        const term = searchTerm.toLowerCase()
        return allOrders.filter(o =>
            o.customer_name?.toLowerCase().includes(term) ||
            o.id?.toLowerCase().includes(term) ||
            String(o.folio || '').includes(term)
        )
    }, [allOrders, searchTerm])

    // ─── Selection helpers ────────────────────────────────────────────────────
    const toggleSelect = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    const toggleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredOrders.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredOrders.map(o => o.id)))
        }
    }, [filteredOrders, selectedIds.size])

    const clearSelection = () => { setSelectedIds(new Set()); setShowBulkBar(false); setBulkStatus('') }

    // Show/hide bulk bar when selection changes
    useEffect(() => {
        setShowBulkBar(selectedIds.size > 0)
    }, [selectedIds.size])

    // Reset selection on tab change
    useEffect(() => { clearSelection() }, [activeTab, timePreset])

    // ─── Mutations ────────────────────────────────────────────────────────────
    const getUserName = () => activeEmployee?.nombre || user?.email || 'Sistema'
    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['orders-active', restaurantId] })
        queryClient.invalidateQueries({ queryKey: ['orders-caja', restaurantId] })
        queryClient.invalidateQueries({ queryKey: ['orders-history', restaurantId] })
        queryClient.invalidateQueries({ queryKey: ['order-stats-live', restaurantId] })
    }

    const updateStatusMutation = useMutation({
        mutationFn: ({ orderId, status }) => updateOrderStatus(orderId, status, restaurantId, getUserName()),
        onSuccess: (data) => { if (selectedOrder?.id === data?.id) setSelectedOrder(data) },
        onError: (err) => toast.error(err.message || 'Error al actualizar'),
        onSettled: invalidateAll
    })

    const updateOrderMutation = useMutation({
        mutationFn: ({ orderId, updates }) => updateOrder(orderId, updates, restaurantId, getUserName()),
        onSuccess: (data) => { setSelectedOrder(data); toast.success('Orden actualizada'); invalidateAll() },
        onError: (error) => toast.error(error.message || 'Error al actualizar'),
    })

    const deleteMutation = useMutation({
        mutationFn: (orderId) => deleteOrder(orderId, restaurantId),
        onSuccess: () => { setSelectedOrder(null); toast.success('Orden eliminada'); invalidateAll() },
        onError: (error) => toast.error(error.message || 'Error al eliminar'),
    })

    const reopenOrderMutation = useMutation({
        mutationFn: (orderId) => reopenOrder(orderId, restaurantId, getUserName()),
        onSuccess: () => { setSelectedOrder(null); toast.success('Orden reabierta'); invalidateAll() },
        onError: (error) => toast.error(error.message || 'Error al reabrir')
    })

    // ─── Bulk Actions ─────────────────────────────────────────────────────────
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)

    const handleBulkStatusChange = async (status) => {
        if (!status || selectedIds.size === 0) return
        setIsBulkProcessing(true)
        const ids = Array.from(selectedIds)
        let success = 0, failed = 0
        for (const id of ids) {
            try {
                await updateOrderStatus(id, status, restaurantId, getUserName())
                success++
            } catch { failed++ }
        }
        setIsBulkProcessing(false)
        clearSelection()
        invalidateAll()
        toast.success(`${success} órdenes actualizadas${failed > 0 ? ` · ${failed} fallaron` : ''}`)
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return

        // Split protected (in cash cut) vs deletable
        const safeOrders = filteredOrders.filter(o => selectedIds.has(o.id) && !o.cash_cut_id)
        const protectedOrders = filteredOrders.filter(o => selectedIds.has(o.id) && !!o.cash_cut_id)

        const msg = protectedOrders.length > 0
            ? `¿Eliminar ${safeOrders.length} órdenes? ⚠️ ${protectedOrders.length} orden(es) en corte de caja NO se eliminarán.`
            : `¿Eliminar ${safeOrders.length} órdenes seleccionadas? Esta acción no se puede deshacer.`

        if (!confirm(msg)) return

        if (safeOrders.length === 0) {
            toast.warning('Ninguna de las órdenes seleccionadas puede eliminarse — todas están en un corte de caja.')
            return
        }

        setIsBulkProcessing(true)
        let success = 0, failed = 0
        for (const order of safeOrders) {
            try { await deleteOrder(order.id, restaurantId); success++ } catch { failed++ }
        }
        setIsBulkProcessing(false)
        clearSelection()
        invalidateAll()

        if (protectedOrders.length > 0) {
            toast.warning(`${success} eliminadas · ${protectedOrders.length} protegidas (en corte de caja)`, { duration: 6000 })
        } else {
            toast.success(`${success} órdenes eliminadas${failed > 0 ? ` · ${failed} fallaron` : ''}`)
        }
    }

    const getTimeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Ahora'
        if (mins < 60) return `${mins}m`
        const hrs = Math.floor(mins / 60)
        return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`
    }

    const isAdmin = !activeEmployee || activeEmployee.rol === 'admin' || activeEmployee.rol === 'gerente'
    const PAYMENT_LABELS = PAYMENT_METHODS
    const allSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length
    const someSelected = selectedIds.size > 0 && selectedIds.size < filteredOrders.length

    // ─── Dynamic Stats ────────────────────────────────────────────────────────
    const getTabStats = () => {
        if (!stats) return []
        if (activeTab === 'activas') return [
            { label: 'En Cola', value: stats.activeSection?.total ?? stats.active, color: '#3B82F6', icon: Package },
            { label: 'Pendientes', value: stats.activeSection?.pending ?? stats.pending, color: '#F59E0B', icon: Clock },
            { label: 'En Preparación', value: stats.activeSection?.inProgress ?? 0, color: '#8B5CF6', icon: ChefHat },
        ]
        if (activeTab === 'caja') return [
            { label: 'Por Cortar', value: stats.cajaSection?.deliveredUncut ?? 0, color: '#F59E0B', icon: Lock },
            { label: 'Canceladas s/corte', value: stats.cajaSection?.cancelledUncut ?? 0, color: '#EF4444', icon: XCircle },
            { label: 'Ingreso Pendiente', value: formatCurrency(stats.cajaSection?.pendingRevenue ?? 0), color: '#10B981', icon: CreditCard },
        ]
        return [
            { label: 'Completadas', value: stats.delivered, color: '#22C55E', icon: CheckCircle2 },
            { label: 'Ingresos Históricos', value: formatCurrency(stats.revenue || 0), color: '#10B981', icon: Archive },
        ]
    }
    const tabStats = getTabStats()

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Órdenes</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                            {isConnected ? <><Wifi className="w-3 h-3" /> EN VIVO</> : <><WifiOff className="w-3 h-3" /> DESCONECTADO</>}
                        </span>
                        <p className="text-muted-foreground text-sm font-medium">Sincronización automática</p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => { refetchAll(); toast.info('Actualizando...') }}
                    className="shrink-0 h-10 rounded-xl font-bold bg-card shadow-sm">
                    <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-muted/50 rounded-2xl mb-4">
                {[
                    { id: 'activas', label: 'Operación Activa', icon: Flame, iconColor: 'text-orange-500', badge: stats?.activeSection?.total },
                    { id: 'caja', label: 'Por Liquidar', icon: Lock, iconColor: 'text-amber-500', badge: stats?.cajaSection?.deliveredUncut },
                    { id: 'historial', label: 'Historial', icon: Archive, iconColor: 'text-primary', badge: null },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === tab.id
                            ? 'bg-background shadow-md text-foreground scale-[1.01]'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.iconColor : ''}`} />
                        {tab.label}
                        {tab.badge > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ─── Time Filter Bar ─── */}
            <div className="bg-card border border-border/60 rounded-2xl p-3 mb-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
                        <SlidersHorizontal className="w-3.5 h-3.5" /> Período:
                    </div>
                    {TIME_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => {
                                setTimePreset(preset.id)
                                setShowCustomPicker(preset.id === 'custom')
                                setHistoryPage(1)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timePreset === preset.id
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                            {preset.id === 'custom' ? <><CalendarDays className="w-3 h-3 inline mr-1" />{preset.label}</> : preset.label}
                        </button>
                    ))}
                    {timePreset !== 'all' && (
                        <button onClick={() => { setTimePreset('all'); setShowCustomPicker(false) }}
                            className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium">
                            <X className="w-3.5 h-3.5" /> Quitar filtro
                        </button>
                    )}
                </div>

                {/* Custom date picker */}
                {showCustomPicker && (
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/60">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Desde:</label>
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary outline-none font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Hasta:</label>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                min={customStart}
                                className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary outline-none font-medium"
                            />
                        </div>
                        {customStart && customEnd && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg font-medium">
                                📅 {new Date(customStart).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} → {new Date(customEnd).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    {tabStats.map((stat, i) => (
                        <Card key={i} onClick={() => setSelectedKpi(stat)}
                            className="border border-border/50 shadow-sm transition-all cursor-pointer hover:-translate-y-1 hover:shadow-md bg-card">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                                    <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner" style={{ background: `${stat.color}15` }}>
                                    <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Section Header + Search + Select All */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                    {/* Select All Checkbox */}
                    <button
                        onClick={toggleSelectAll}
                        className={`flex items-center gap-2 text-xs font-bold transition-colors rounded-lg px-3 py-2 ${allSelected || someSelected
                            ? 'text-primary bg-primary/10 hover:bg-primary/20'
                            : 'text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground'}`}
                        title="Seleccionar todo"
                    >
                        {allSelected ? (
                            <CheckSquare className="w-4 h-4" />
                        ) : someSelected ? (
                            <CheckSquare className="w-4 h-4 opacity-60" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">
                            {allSelected ? 'Deseleccionar todo' : `Seleccionar todo (${filteredOrders.length})`}
                        </span>
                    </button>

                    <h2 className="text-sm font-black text-muted-foreground">
                        {filteredOrders.length} {activeTab === 'activas' ? 'activas' : activeTab === 'caja' ? 'por liquidar' : 'en historial'}
                        {timePreset !== 'all' && <span className="text-primary ml-1">· {TIME_PRESETS.find(p => p.id === timePreset)?.label}</span>}
                    </h2>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cliente, ID o folio..." value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 rounded-xl bg-card border-border/50" />
                </div>
            </div>

            {/* ─── Bulk Action Bar ─── */}
            {showBulkBar && (
                <div className="sticky top-4 z-30 mb-4 bg-card border-2 border-primary/30 rounded-2xl p-3 shadow-lg shadow-primary/10 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 font-black text-sm text-primary">
                        <CheckSquare className="w-5 h-5" />
                        {selectedIds.size} seleccionadas
                    </div>
                    <div className="flex-1" />

                    {/* Bulk status change */}
                    {activeTab === 'activas' && (
                        <div className="flex items-center gap-2">
                            <select
                                value={bulkStatus}
                                onChange={e => setBulkStatus(e.target.value)}
                                className="h-9 px-3 text-xs font-bold rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Cambiar estado a...</option>
                                {Object.entries(ORDER_STATUSES).map(([key, info]) => (
                                    <option key={key} value={key}>{info.emoji} {info.label}</option>
                                ))}
                            </select>
                            <Button size="sm" className="h-9 font-bold rounded-lg"
                                disabled={!bulkStatus || isBulkProcessing}
                                onClick={() => handleBulkStatusChange(bulkStatus)}>
                                {isBulkProcessing ? 'Procesando...' : 'Aplicar'}
                            </Button>
                        </div>
                    )}

                    {/* Bulk delete */}
                    {isAdmin && (
                        <Button size="sm" variant="destructive" className="h-9 font-bold rounded-lg"
                            disabled={isBulkProcessing} onClick={handleBulkDelete}>
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            Eliminar ({selectedIds.size})
                        </Button>
                    )}
                    <button onClick={clearSelection}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Orders List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-border/50 shadow-sm">
                        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold">Cargando órdenes...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-border/50 shadow-sm">
                        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="text-foreground font-black text-xl mb-1">
                            {searchTerm ? 'Sin resultados' : timePreset !== 'all'
                                ? `Sin órdenes en el período seleccionado`
                                : activeTab === 'activas' ? 'Sin órdenes activas'
                                    : activeTab === 'caja' ? 'Nada pendiente de corte'
                                        : 'El historial está vacío'}
                        </p>
                        <p className="text-muted-foreground/80 text-sm font-medium">
                            {timePreset !== 'all' ? 'Prueba con otro período de tiempo.' : 'Las nuevas órdenes aparecerán aquí.'}
                        </p>
                    </div>
                ) : (
                    <div className={activeTab === 'activas' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-col gap-2'}>
                        {filteredOrders.map(order => {
                            const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending
                            const payment = PAYMENT_LABELS[order.payment_method] || PAYMENT_LABELS.cash
                            const items = Array.isArray(order.items) ? order.items : []
                            const isSelected = selectedIds.has(order.id)
                            const isGhostOrder = activeTab === 'activas' && (Date.now() - new Date(order.created_at).getTime()) > (8 * 60 * 60 * 1000)

                            if (activeTab === 'activas') {
                                return (
                                    <div key={order.id}
                                        className={`bg-card border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden ${isSelected
                                            ? 'border-primary/60 shadow-md shadow-primary/10 ring-2 ring-primary/20'
                                            : isGhostOrder ? 'border-red-500/50'
                                                : order.status === 'pending' ? 'border-amber-400/50 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10'
                                                    : 'border-border/60 hover:border-primary/40'}`}
                                    >
                                        {isGhostOrder && (
                                            <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[10px] uppercase font-black tracking-widest text-center py-0.5 flex items-center justify-center gap-1.5">
                                                <AlertTriangle className="w-3 h-3" /> Orden antigua — Requiere Acción
                                            </div>
                                        )}

                                        <div className={`flex items-start gap-3 mb-4 ${isGhostOrder ? 'mt-4' : ''}`}>
                                            {/* Checkbox */}
                                            <button
                                                onClick={e => { e.stopPropagation(); toggleSelect(order.id) }}
                                                className="mt-1 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                {isSelected
                                                    ? <CheckSquare className="w-5 h-5 text-primary" />
                                                    : <Square className="w-5 h-5" />
                                                }
                                            </button>

                                            <div className="flex-1 min-w-0" onClick={() => setSelectedOrder(order)}>
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="font-black text-lg text-foreground tracking-tight">{order.customer_name || 'Cliente General'}</span>
                                                    <span className="text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-md text-white shrink-0 shadow-sm" style={{ background: statusInfo.color }}>
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-muted-foreground">
                                                    <span className="bg-muted px-2 py-0.5 rounded-md text-foreground">
                                                        {order.order_type === 'delivery' ? '🛵 Domicilio' : order.order_type === 'dine_in' ? '🪑 Mesa' : '🏪 Llevar'}
                                                    </span>
                                                    {order.table_number && <span className="text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 rounded-md">Mesa {order.table_number}</span>}
                                                    <span className="opacity-70">#{order.folio || order.id.slice(0, 5)}</span>
                                                    <span className="flex items-center gap-1 opacity-70"><Clock className="w-3 h-3" />{getTimeAgo(order.created_at)}</span>
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right" onClick={() => setSelectedOrder(order)}>
                                                <p className="font-black text-foreground text-sm">{formatCurrency(order.total)}</p>
                                            </div>
                                        </div>

                                        <div className="bg-muted/40 rounded-xl p-3 mb-4 space-y-1" onClick={() => setSelectedOrder(order)}>
                                            {items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex text-sm">
                                                    <span className="font-medium text-foreground truncate pr-4">
                                                        <span className="font-black text-muted-foreground mr-1.5">{item.quantity}x</span>
                                                        {item.product?.name || item.name || 'Producto'}
                                                    </span>
                                                </div>
                                            ))}
                                            {items.length > 3 && <p className="text-xs font-bold text-muted-foreground pt-1">+ {items.length - 3} más</p>}
                                        </div>

                                        <div className="flex gap-2">
                                            {getNextStatuses(order.status).map(next => {
                                                const nextInfo = ORDER_STATUSES[next]
                                                if (!nextInfo) return null
                                                return (
                                                    <button key={next}
                                                        onClick={e => { e.stopPropagation(); updateStatusMutation.mutate({ orderId: order.id, status: next }) }}
                                                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white hover:brightness-110 active:scale-95 transition-all shadow-sm"
                                                        style={{ background: nextInfo.color }}>
                                                        {nextInfo.emoji} {nextInfo.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            }

                            // List style for Caja & Historial
                            return (
                                <div key={order.id}
                                    className={`bg-card border rounded-xl p-3 cursor-pointer transition-all hover:bg-muted/30 flex items-center gap-3 ${isSelected
                                        ? 'border-primary/60 shadow-sm shadow-primary/10 ring-2 ring-primary/20'
                                        : 'border-border/50'}`}
                                >
                                    {/* Checkbox */}
                                    <button
                                        onClick={e => { e.stopPropagation(); toggleSelect(order.id) }}
                                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {isSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5" />}
                                    </button>

                                    <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setSelectedOrder(order)}>
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg" style={{ background: `${statusInfo.color}15` }}>
                                            {statusInfo.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-sm text-foreground truncate">{order.customer_name || 'Cliente General'}</span>
                                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded shrink-0" style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}>
                                                    {statusInfo.label}
                                                </span>
                                                {activeTab === 'historial' && order.cash_cut_id && (
                                                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded shrink-0">🔒 Cortada</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                                                <span>#{order.folio || order.id.slice(0, 6)}</span>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <span>{payment.icon} {payment.label}</span>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <span>{new Date(order.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 pr-1" onClick={() => setSelectedOrder(order)}>
                                        <p className="font-black text-foreground">{formatCurrency(order.total)}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{items.length} items</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {activeTab === 'historial' && (
                    <div className="pt-4 flex items-center justify-between bg-card p-4 rounded-xl border border-border/60 mt-4">
                        <p className="text-sm font-bold text-muted-foreground">
                            Página {historyPage} de {Math.max(1, Math.ceil(totalHistoryCount / 50))}
                            <span className="font-normal opacity-70 ml-1">({totalHistoryCount} órdenes)</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                disabled={historyPage === 1 || isLoadingHistory} className="font-bold rounded-lg h-9">
                                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                            </Button>
                            <Button variant="outline" onClick={() => setHistoryPage(p => Math.min(Math.ceil(totalHistoryCount / 50), p + 1))}
                                disabled={historyPage >= Math.ceil(totalHistoryCount / 50) || isLoadingHistory} className="font-bold rounded-lg h-9">
                                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedOrder(null)}
                    onUpdateStatus={(status) => {
                        updateStatusMutation.mutate({ orderId: selectedOrder.id, status })
                        setSelectedOrder({ ...selectedOrder, status })
                    }}
                    onUpdateOrder={(updates) => updateOrderMutation.mutate({ orderId: selectedOrder.id, updates })}
                    onDelete={() => deleteMutation.mutate(selectedOrder.id)}
                    onReopenOrder={() => reopenOrderMutation.mutate(selectedOrder.id)}
                />
            )}

            {/* KPI Modal */}
            <KpiDrilldownModal
                isOpen={!!selectedKpi}
                onClose={() => setSelectedKpi(null)}
                kpi={selectedKpi}
                queryKey={['kpi-modal', restaurantId, selectedKpi?.label, startDate, endDate]}
                fetchFn={async (page, pageSize) => {
                    const label = selectedKpi?.label
                    const mode = (label === 'En Cola' || label === 'Pendientes' || label === 'En Preparación') ? 'active'
                        : (label === 'Por Cortar' || label === 'Canceladas s/corte' || label === 'Ingreso Pendiente') ? 'caja'
                            : 'historial'
                    return await getOrders(restaurantId, { mode, page, pageSize, startDate, endDate })
                }}
                renderItem={(order) => {
                    const si = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending
                    return (
                        <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 bg-card gap-3">
                            <div>
                                <p className="font-bold flex items-center gap-2">
                                    {order.customer_name || 'Cliente General'}
                                    <span className="text-[10px] font-mono opacity-60 bg-muted px-1.5 py-0.5 rounded">#{String(order.id).slice(0, 6)}</span>
                                </p>
                                <p className="text-sm text-muted-foreground my-1">{si.emoji} {si.label}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {new Date(order.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="font-black text-lg text-primary">{formatCurrency(order.total)}</p>
                                <Button variant="secondary" size="sm" className="h-8 text-xs font-bold"
                                    onClick={() => { setSelectedKpi(null); setSelectedOrder(order) }}>Ver</Button>
                            </div>
                        </div>
                    )
                }}
            />
        </div>
    )
}
