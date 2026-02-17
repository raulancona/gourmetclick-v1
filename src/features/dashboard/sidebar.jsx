import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, FolderTree, Settings, LogOut } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Menú', href: '/products', icon: UtensilsCrossed },
    { name: 'Categorías', href: '/categories', icon: FolderTree },
    { name: 'Configuración', href: '/settings', icon: Settings },
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

    const userInitials = user?.email?.substring(0, 2).toUpperCase() || 'U'

    return (
        <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
            {/* Logo */}
            <div className="flex h-16 items-center border-b border-border px-6">
                <h1 className="text-xl font-bold">MenuDigital</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                }`}
                        >
                            <Icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* User section */}
            <div className="border-t border-border p-4">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src="" alt={user?.email} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{user?.email}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout}
                        title="Cerrar sesión"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
