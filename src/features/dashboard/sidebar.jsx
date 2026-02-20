import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, FolderTree, ClipboardList, Settings, LogOut, Calculator, ChefHat, Home, Grid, Package, Sun, Moon, Globe, BarChart3, Receipt, Lock } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { useTerminal } from '../auth/terminal-context'
import { useTheme } from '../../components/theme-provider'
import { toast } from 'sonner'

export function Sidebar({ isOpen, onClose }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const { activeEmployee, logout: terminalLock } = useTerminal()
    const { theme, setTheme } = useTheme()
    const { profile } = useAuth()

    const isSuperAdmin = profile?.role === 'superadmin'
    const isOwner = profile?.role === 'owner'
    const isAdmin = (isOwner || isSuperAdmin) && !activeEmployee
    const isCajero = activeEmployee?.rol === 'cajero'
    const isMesero = activeEmployee?.rol === 'mesero'

    const navigation = [
        { name: 'Inicio', href: '/dashboard', icon: Home, roles: ['admin'] },
        { name: 'POS', href: '/pos', icon: Grid, roles: ['admin', 'cajero', 'mesero'] },
        { name: 'Órdenes', href: '/orders', icon: ClipboardList, roles: ['admin', 'cajero'] },
        { name: 'Menú', href: '/products', icon: Package, roles: ['admin'] },
        { name: 'Categorías', href: '/categories', icon: FolderTree, roles: ['admin'] },
        { name: 'Caja', href: '/caja', icon: Calculator, roles: ['admin', 'cajero'] },
        { name: 'Gastos', href: '/expenses', icon: Receipt, roles: ['admin'] },
        { name: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['admin'] },
        { name: 'Personal', href: '/staff', icon: Settings, roles: ['admin'] }, // Placeholder for staff management link
        { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
    ].filter(item => {
        if (isAdmin) return true // Admin sees everything
        return item.roles.includes(activeEmployee?.rol)
    })

    const handleLogout = async () => {
        try {
            await signOut()
            toast.success('Sesión cerrada correctamente')
            navigate('/login')
        } catch (error) {
            toast.error('Error al cerrar sesión')
        }
    }

    const handleLock = () => {
        terminalLock()
        toast.info('Terminal bloqueado')
    }

    if (isMesero) return null // Strict rule: Waiters only see POS, no sidebar. We handle POS full view.

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
                fixed inset-y-0 left-0 z-50 h-screen w-64 flex flex-col items-center border-r border-border bg-card py-6 shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="flex items-center gap-3 mb-8 px-6 w-full">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                        <ChefHat className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-foreground text-lg leading-none tracking-tight">Gourmet</span>
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-primary text-sm leading-none tracking-wider">CLICK</span>
                            {isSuperAdmin && <span className="text-[10px] bg-red-500 text-white px-1 rounded font-black leading-none">PRO</span>}
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-4 w-full px-2 overflow-y-auto no-scrollbar">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                title={item.name}
                                onClick={onClose}
                                className={`
                                    flex items-center w-full px-4 py-3 rounded-xl transition-all cursor-pointer gap-3 shrink-0
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                                `}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                                <span className="font-medium text-sm">{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* User section */}
                <div className="mt-auto px-4 w-full space-y-4">
                    {activeEmployee && (
                        <div className="bg-muted/50 p-3 rounded-2xl flex items-center gap-3 border border-border">
                            <div className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center font-black text-xs">
                                {activeEmployee.nombre[0]}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary leading-tight">{activeEmployee.rol}</span>
                                <span className="text-xs font-bold text-foreground truncate">{activeEmployee.nombre}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="flex-1 h-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all border border-transparent"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        {activeEmployee ? (
                            <button
                                onClick={handleLock}
                                title="Bloquear Terminal"
                                className="flex-1 h-11 flex items-center justify-center text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all border border-amber-200/50"
                            >
                                <Lock className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleLogout}
                                title="Cerrar sesión"
                                className="flex-1 h-11 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
