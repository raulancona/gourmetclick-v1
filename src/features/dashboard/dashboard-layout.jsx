import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Sidebar } from './sidebar'

export function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <div className="flex h-screen overflow-hidden relative">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(c => !c)}
            />

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Mobile Top Bar */}
                <header className="lg:hidden h-16 border-b border-border bg-card flex items-center px-4 shrink-0 z-30">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-primary/10 hover:text-primary transition-colors rounded-xl"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                    <div className="ml-4 flex flex-col leading-none">
                        <span className="font-black text-foreground text-sm tracking-tight uppercase">Gourmet</span>
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-primary text-[10px] tracking-wider uppercase leading-none">Click Pro</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto scrollbar-hide bg-background p-0 w-full min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
