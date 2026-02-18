import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, FolderTree, ClipboardList, Settings, LogOut, Calculator, ChefHat, Home, Grid, Package, Sun, Moon, Globe, BarChart3 } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { useTheme } from '../../components/theme-provider'
import { toast } from 'sonner'
const navigation = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'POS', href: '/pos', icon: Grid },
    { name: 'Órdenes', href: '/orders', icon: ClipboardList },
    { name: 'Menú', href: '/products', icon: Package },
    { name: 'Categorías', href: '/categories', icon: FolderTree },
    { name: 'Caja', href: '/caja', icon: Calculator },
    { name: 'Reportes', href: '/reportes', icon: BarChart3 },
    { name: 'LinkCard', href: '/menu-links', icon: Globe },
    { name: 'Ajustes', href: '/settings', icon: Settings },
]

export function Sidebar({ isOpen, onClose }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const { theme, setTheme } = useTheme()

    const handleLogout = async () => {
        try {
            await signOut()
            toast.success('Sesión cerrada correctamente')
            navigate('/login')
        } catch (error) {
            toast.error('Error al cerrar sesión')
        }
    }

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
                        <span className="font-bold text-primary text-sm leading-none tracking-wider">CLICK</span>
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
                <div className="mt-auto pt-4 shrink-0 flex flex-col gap-2">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        title="Cambiar tema"
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={handleLogout}
                        title="Cerrar sesión"
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </aside>
        </>
    )
}
