import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, UtensilsCrossed, FolderTree, ClipboardList,
    Settings, LogOut, Calculator, ChefHat, Home, Grid, Package,
    Sun, Moon, Globe, BarChart3, Receipt, Lock, ChevronLeft, ChevronRight,
    PanelLeftClose, PanelLeftOpen, Users
} from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { useTerminal } from '../auth/terminal-context'
import { useTheme } from '../../components/theme-provider'
import { toast } from 'sonner'

// Nav groups with sections
const NAV_GROUPS = [
    {
        label: 'Operación',
        items: [
            { name: 'Inicio', href: '/dashboard', icon: Home, roles: ['admin'] },
            { name: 'POS', href: '/pos', icon: Grid, roles: ['admin', 'cajero', 'mesero'] },
            { name: 'Órdenes', href: '/orders', icon: ClipboardList, roles: ['admin', 'cajero'] },
        ]
    },
    {
        label: 'Menú',
        items: [
            { name: 'Menú', href: '/products', icon: Package, roles: ['admin'] },
            { name: 'Categorías', href: '/categories', icon: FolderTree, roles: ['admin'] },
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
    const { theme, setTheme } = useTheme()

    const isSuperAdmin = profile?.role === 'superadmin'
    const isOwner = profile?.role === 'owner' || (user && !activeEmployee)
    const isAdmin = (isOwner || isSuperAdmin) && !activeEmployee
    const isMesero = activeEmployee?.rol === 'mesero'

    const userRole = isAdmin ? 'admin' : (activeEmployee?.rol || 'guest')

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
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 h-screen flex flex-col border-r border-border bg-card py-4 shrink-0
                transition-all duration-300 ease-in-out
                lg:static lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                ${isCollapsed ? 'w-16' : 'w-64'}
            `}>
                {/* Header: Logo + Collapse Toggle */}
                <div className={`flex items-center mb-6 px-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                                <ChefHat className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col leading-none overflow-hidden">
                                <span className="font-black text-foreground text-base tracking-tight">Gourmet</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-primary text-xs tracking-wider">CLICK</span>
                                    <span className="text-[9px] bg-primary text-primary-foreground px-1 rounded font-black">PRO</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <ChefHat className="w-5 h-5" />
                        </div>
                    )}

                    {/* Desktop collapse toggle */}
                    <button
                        onClick={onToggleCollapse}
                        className={`hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all ${isCollapsed ? 'mt-0' : ''}`}
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
                        <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
                            {/* Group label — hidden when collapsed */}
                            {!isCollapsed && (
                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 px-3 mb-1.5">
                                    {group.label}
                                </p>
                            )}
                            {isCollapsed && gi > 0 && (
                                <div className="h-px bg-border/40 mx-2 mb-2" />
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
                                            className={`
                                                flex items-center w-full rounded-xl transition-all cursor-pointer gap-3 shrink-0 group relative
                                                ${isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
                                                ${isActive
                                                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                                            `}
                                        >
                                            <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />

                                            {!isCollapsed && (
                                                <span className="font-medium text-sm truncate">{item.name}</span>
                                            )}

                                            {/* Tooltip when collapsed */}
                                            {isCollapsed && (
                                                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-bold rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 translate-x-1 group-hover:translate-x-0">
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

                {/* Footer: User info + actions */}
                <div className={`mt-auto px-2 w-full space-y-2 pt-3 border-t border-border`}>
                    {/* Employee badge */}
                    {activeEmployee && !isCollapsed && (
                        <div className="bg-muted/50 p-2.5 rounded-xl flex items-center gap-2.5 border border-border">
                            <div className="w-7 h-7 bg-primary/20 text-primary rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                                {activeEmployee.nombre[0]}
                            </div>
                            <div className="flex flex-col overflow-hidden min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-primary leading-tight">{activeEmployee.rol}</span>
                                <span className="text-xs font-bold text-foreground truncate">{activeEmployee.nombre}</span>
                            </div>
                        </div>
                    )}
                    {activeEmployee && isCollapsed && (
                        <div title={activeEmployee.nombre} className="flex justify-center">
                            <div className="w-9 h-9 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black text-sm">
                                {activeEmployee.nombre[0]}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className={`flex gap-1.5 ${isCollapsed ? 'flex-col items-center' : 'items-center'}`}>
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                            className="flex-1 h-9 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        {activeEmployee ? (
                            <button
                                onClick={handleLock}
                                title="Bloquear Terminal"
                                className="flex-1 h-9 flex items-center justify-center text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all"
                            >
                                <Lock className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleLogout}
                                title="Cerrar sesión"
                                className="flex-1 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
