import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCustomers } from '../lib/customer-service'
import { useTenant } from '../features/auth/tenant-context'
import {
    Users, Search, Star, Phone, Mail,
    CalendarDays, Loader2, Award, ArrowUpRight
} from 'lucide-react'
import { Input } from '../components/ui/input'
import { formatCurrency } from '../lib/utils'

export function CustomersPage() {
    const { tenant } = useTenant()
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState('total_spent') // total_spent, orders, recent

    const { data: customers, isLoading, error } = useQuery({
        queryKey: ['customers', tenant?.id],
        queryFn: () => getCustomers(tenant?.id),
        enabled: !!tenant?.id,
        staleTime: 1000 * 60 * 5 // 5 min cache
    })

    const filteredAndSortedCustomers = useMemo(() => {
        if (!customers) return []

        let filtered = customers.filter(c => {
            if (!searchTerm) return true
            const term = searchTerm.toLowerCase()
            return (
                (c.name && c.name.toLowerCase().includes(term)) ||
                (c.phone && c.phone.includes(term)) ||
                (c.email && c.email.toLowerCase().includes(term))
            )
        })

        return filtered.sort((a, b) => {
            if (sortBy === 'total_spent') return (b.total_spent || 0) - (a.total_spent || 0)
            if (sortBy === 'orders') return (b.total_orders || 0) - (a.total_orders || 0)
            if (sortBy === 'recent') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
            return 0
        })
    }, [customers, searchTerm, sortBy])

    // KPIs
    const totalCustomers = customers?.filter(c => c.name?.toLowerCase() !== 'cliente mostrador')?.length || 0
    const mostradorOrders = customers?.find(c => c.name?.toLowerCase() === 'cliente mostrador')?.total_orders || 0
    const topClient = [...(customers || [])].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))[0]

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <Users className="w-10 h-10 text-primary" />
                        Directorio de Clientes
                    </h1>
                    <p className="text-muted-foreground font-medium mt-2 text-lg">
                        Gestiona, conoce y fideliza a quienes compran en tu restaurante.
                    </p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-24 h-24" />
                    </div>
                    <p className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-2">Total de Clientes</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-5xl font-black text-foreground">{totalCustomers}</p>
                        <span className="text-sm font-bold text-muted-foreground">registrados</span>
                    </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Award className="w-24 h-24 text-primary" />
                    </div>
                    <p className="text-sm font-black text-primary uppercase tracking-widest mb-2">Mejor Cliente</p>
                    {topClient ? (
                        <>
                            <p className="text-2xl font-black text-foreground truncate">{topClient.name || 'Desconocido'}</p>
                            <p className="text-primary font-bold mt-1">{formatCurrency(topClient.total_spent)} LTV</p>
                        </>
                    ) : (
                        <p className="text-xl font-bold text-muted-foreground">Sin datos</p>
                    )}
                </div>

                <div className="bg-muted/30 border border-border/50 rounded-3xl p-6 shadow-sm">
                    <p className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-2">Ventas de Mostrador</p>
                    <p className="text-4xl font-black text-foreground">{mostradorOrders}</p>
                    <p className="text-sm font-bold text-muted-foreground mt-1">órdenes sin registro</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente por nombre, teléfono o email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-12 h-14 rounded-2xl bg-card border-border shadow-sm text-base font-medium"
                    />
                </div>
                <div className="flex gap-2">
                    {['total_spent', 'orders', 'recent'].map(sortOption => (
                        <button
                            key={sortOption}
                            onClick={() => setSortBy(sortOption)}
                            className={`px-4 h-14 rounded-2xl font-bold text-sm transition-all border ${sortBy === sortOption
                                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                : 'bg-card border-border hover:bg-muted text-muted-foreground'
                                }`}
                        >
                            {sortOption === 'total_spent' ? 'Más Gastan' : sortOption === 'orders' ? 'Más Órdenes' : 'Recientes'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>
            ) : filteredAndSortedCustomers.length === 0 ? (
                <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
                    <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <h3 className="text-xl font-black text-foreground">No encontramos clientes</h3>
                    <p className="text-muted-foreground font-medium mt-2">Intenta intentar con otros filtros de búsqueda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAndSortedCustomers.map(customer => {
                        const isWalkIn = customer.name?.toLowerCase() === 'cliente mostrador';
                        const isTop = customer.id === topClient?.id;

                        return (
                            <div key={customer.id} className="bg-card border border-border hover:border-primary/50 transition-all rounded-3xl p-6 shadow-sm hover:shadow-md group flex flex-col h-full relative overflow-hidden">
                                {isTop && (
                                    <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl border-b border-l border-primary/20 flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-primary" /> VIP
                                    </div>
                                )}

                                <div className="flex items-start gap-4 mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${isWalkIn ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                        {isWalkIn ? <Users className="w-6 h-6" /> : (customer.name?.[0]?.toUpperCase() || 'C')}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <h3 className="text-lg font-black text-foreground truncate">{customer.name || 'Desconocido'}</h3>
                                        {customer.phone && (
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium mt-1">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span>{customer.phone}</span>
                                            </div>
                                        )}
                                        {customer.email && (
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium mt-0.5">
                                                <Mail className="w-3.5 h-3.5" />
                                                <span className="truncate">{customer.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
                                    <div className="bg-muted/30 p-3 rounded-xl border border-border/40 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Órdenes Totales</p>
                                        <p className="text-xl font-black text-foreground">{customer.total_orders || 0}</p>
                                    </div>
                                    <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Gasto Histórico</p>
                                        <p className="text-xl font-black text-emerald-700">{formatCurrency(customer.total_spent || 0)}</p>
                                    </div>
                                </div>

                                {customer.last_order_date && (
                                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/20 py-2 rounded-lg">
                                        <CalendarDays className="w-3.5 h-3.5" />
                                        Última orden: {new Date(customer.last_order_date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
