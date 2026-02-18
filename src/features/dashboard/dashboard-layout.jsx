import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Sidebar } from './sidebar'

export function DashboardLayout() {
    const location = useLocation()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="flex h-screen overflow-hidden relative">
            {/* Mobile Toggle Button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <Button
                    variant="ghost"
                    size="icon"
                    className="bg-white shadow-md rounded-full"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <Menu className="w-5 h-5" />
                </Button>
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="flex-1 overflow-y-auto scrollbar-hide bg-background p-0 w-full">
                <Outlet />
            </main>
        </div>
    )
}
