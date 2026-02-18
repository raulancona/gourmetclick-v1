import { CompanyProfileForm } from '../features/settings/company-profile-form'
import { BulkImageUpload } from '../features/dashboard/BulkImageUpload'

export function SettingsPage() {
    return (
        <div className="p-8 space-y-8">
            <div className="">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configuración</h1>
                <p className="text-gray-500">
                    Administra la configuración de tu cuenta y empresa
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Perfil de la Empresa</h2>
                    <CompanyProfileForm />
                </div>

                <div className="space-y-6">
                    <BulkImageUpload />
                </div>
            </div>
        </div>
    )
}
