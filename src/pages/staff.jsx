import { StaffManagement } from '../features/admin/staff-management'

export function StaffPage() {
    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Gestión de Equipo</h1>
                <p className="text-muted-foreground font-medium">Configuración de accesos y personal operativo</p>
            </div>

            <StaffManagement />
        </div>
    )
}
