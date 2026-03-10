import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, UtensilsCrossed, FolderTree, ClipboardList,
    Settings, LogOut, Calculator, ChefHat, Home, Grid, Package,
    Globe, BarChart3, Receipt, Lock, ChevronLeft, ChevronRight,
    PanelLeftClose, PanelLeftOpen, Users, Layers
} from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { useTerminal } from '../auth/terminal-context'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'

// Nav groups with sections
const NAV_GROUPS = [
    {
        label: 'Operación',
        items: [
            { name: 'Inicio', href: '/dashboard', icon: Home, roles: ['admin'] },
            { name: 'POS', href: '/pos', icon: Grid, roles: ['admin', 'cajero', 'mesero'] },
            { name: 'Órdenes', href: '/orders', icon: ClipboardList, roles: ['admin', 'cajero'] },
            { name: 'Clientes (CRM)', href: '/customers', icon: Users, roles: ['admin', 'cajero'] },
        ]
    },
    {
        label: 'Menú',
        items: [
            { name: 'Productos', href: '/products', icon: Package, roles: ['admin'] },
            { name: 'Categorías', href: '/categories', icon: FolderTree, roles: ['admin'] },
            { name: 'Modificadores', href: '/modifiers', icon: Layers, roles: ['admin'] },
        ]
    },
    {
        label: 'Finanzas',
        items: [
            { name: 'Caja', href: '/caja', icon: Calculator, roles: ['admin', 'cajero'] },
            { name: 'Gastos', href: '/expenses', icon: Receipt, roles: ['admin'] },
            { name: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['admin'] },
        ]
    },
    {
        label: 'Config',
        items: [
            { name: 'Staff', href: '/staff', icon: Users, roles: ['admin'] },
            { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
        ]
    }
]

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut, profile } = useAuth()
    const { activeEmployee, logout: terminalLock } = useTerminal()

    const isSuperAdmin = profile?.role === 'superadmin'
    const isOwner = profile?.role === 'owner' || (user && !activeEmployee)
    const isAdmin = (isOwner || isSuperAdmin) && !activeEmployee
    const isMesero = activeEmployee?.rol === 'mesero'

    const userRole = (isAdmin || activeEmployee?.rol === 'gerente') ? 'admin' : (activeEmployee?.rol || 'guest')

    const visibleGroups = NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item =>
            isAdmin || item.roles.includes(userRole)
        )
    })).filter(g => g.items.length > 0)

    const handleLogout = async () => {
        try {
            await signOut()
            toast.success('Sesión cerrada correctamente')
            navigate('/login')
        } catch {
            toast.error('Error al cerrar sesión')
        }
    }

    const handleLock = () => {
        terminalLock()
        toast.info('Terminal bloqueado')
    }

    if (isMesero) return null

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 h-screen flex flex-col border-r border-border/60 py-4 shrink-0 transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
                "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800",
                isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
                isCollapsed ? 'w-16' : 'w-64'
            )}>
                {/* Header: Logo + Collapse Toggle */}
                <div className={cn("flex items-center mb-6 px-3", isCollapsed ? 'justify-center' : 'justify-between')}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                                <ChefHat className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col leading-none overflow-hidden">
                                <span className="font-black text-white text-base tracking-tight font-display">Gourmet</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-indigo-400 text-xs tracking-wider">CLICK</span>
                                    <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-md font-black shadow-sm">PRO</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <ChefHat className="w-5 h-5" />
                        </div>
                    )}

                    <button
                        onClick={onToggleCollapse}
                        className={`hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all ${isCollapsed ? 'mt-0' : ''}`}
                        title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                    >
                        {isCollapsed
                            ? <PanelLeftOpen className="w-4 h-4" />
                            : <PanelLeftClose className="w-4 h-4" />
                        }
                    </button>
                </div>

                {/* Navigation Groups */}
                <nav className="flex-1 flex flex-col gap-1 w-full px-2 overflow-y-auto no-scrollbar">
                    {visibleGroups.map((group, gi) => (
                        <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
                            {/* Group label */}
                            {!isCollapsed && (
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 px-3 mb-1.5">
                                    {group.label}
                                </p>
                            )}
                            {isCollapsed && gi > 0 && (
                                <div className="h-px bg-white/10 mx-2 mb-2" />
                            )}

                            <div className="flex flex-col gap-0.5">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.href
                                    const Icon = item.icon

                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={onClose}
                                            title={isCollapsed ? item.name : undefined}
                                            className={cn(
                                                "flex items-center w-full rounded-xl transition-all cursor-pointer gap-3 shrink-0 group relative",
                                                isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5',
                                                isActive
                                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25'
                                                    : 'text-slate-400 hover:bg-white/8 hover:text-white'
                                            )}
                                        >
                                            <Icon className={cn("shrink-0", isActive ? "w-[18px] h-[18px] stroke-[2.5px]" : "w-[18px] h-[18px] stroke-2")} />

                                            {!isCollapsed && (
                                                <span className="font-semibold text-sm truncate">{item.name}</span>
                                            )}

                                            {/* Tooltip when collapsed */}
                                            {isCollapsed && (
                                                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 translate-x-1 group-hover:translate-x-0">
                                                    {item.name}
                                                </div>
                                            )}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="mt-auto px-2 w-full space-y-2 pt-3 border-t border-white/10">
                    {/* Employee badge */}
                    {activeEmployee && !isCollapsed && (
                        <div className="bg-white/8 p-2.5 rounded-xl flex items-center gap-2.5 border border-white/10">
                            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                                {activeEmployee.nombre[0]}
                            </div>
                            <div className="flex flex-col overflow-hidden min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 leading-tight">{activeEmployee.rol}</span>
                                <span className="text-xs font-bold text-white truncate">{activeEmployee.nombre}</span>
                            </div>
                        </div>
                    )}
                    {activeEmployee && isCollapsed && (
                        <div title={activeEmployee.nombre} className="flex justify-center">
                            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm">
                                {activeEmployee.nombre[0]}
                            </div>
                        </div>
                    )}

                    <div className={cn("flex gap-1.5", isCollapsed ? 'flex-col items-center' : 'items-center')}>
                        {activeEmployee ? (
                            <button
                                onClick={handleLock}
                                title="Bloquear Terminal"
                                className="flex-1 h-9 flex items-center justify-center gap-2 text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all text-xs font-bold"
                            >
                                <Lock className="w-4 h-4" />
                                {!isCollapsed && 'Bloquear'}
                            </button>
                        ) : (
                            <button
                                onClick={handleLogout}
                                title="Cerrar sesión"
                                className="flex-1 h-9 flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-xs font-bold"
                            >
                                <LogOut className="w-4 h-4" />
                                {!isCollapsed && 'Salir'}
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
