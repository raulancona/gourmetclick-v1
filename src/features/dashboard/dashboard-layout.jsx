import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './sidebar'

export function DashboardLayout() {
    const location = useLocation()
    const isPOS = location.pathname.startsWith('/dashboard/pos') || location.pathname === '/pos'

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-background p-0">
                <Outlet />
            </main>
        </div>
    )
}
