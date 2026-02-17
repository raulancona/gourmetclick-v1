import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, FolderTree, ClipboardList, Settings, LogOut, Calculator, ChefHat, Home, Grid, Package } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

const navigation = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'POS', href: '/pos', icon: Grid },
    { name: 'Órdenes', href: '/orders', icon: ClipboardList },
    { name: 'Menú', href: '/products', icon: Package },
    { name: 'Categorías', href: '/categories', icon: FolderTree },
    { name: 'Ajustes', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()

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
        <div className="flex h-screen w-20 flex-col items-center border-r border-border bg-card py-6 shrink-0 z-20">
            {/* Logo */}
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-8">
                <ChefHat className="w-6 h-6" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-2">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            title={item.name}
                            className={`
                                flex flex-col items-center justify-center w-full aspect-square rounded-xl transition-all cursor-pointer gap-1
                                ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
                            `}
                        >
                            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                        </Link>
                    )
                })}
            </nav>

            {/* User section */}
            <div className="mt-auto">
                <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </div>
    )
}
