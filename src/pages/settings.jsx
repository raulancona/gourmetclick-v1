import { CompanyProfileForm } from '../features/settings/company-profile-form'

export function SettingsPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground">
                    Administra la configuración de tu cuenta y empresa
                </p>
            </div>

            <div className="max-w-2xl">
                <CompanyProfileForm />
            </div>
        </div>
    )
}
