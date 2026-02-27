import { useState } from 'react'
import { CompanyProfileForm } from '../features/settings/company-profile-form'
import { MenuAppearanceForm } from '../features/settings/menu-appearance-form'
import { MobilePreview } from '../features/settings/mobile-preview'
import { TerminalAccessCard } from '../features/settings/terminal-access-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Palette, Building2, Smartphone } from 'lucide-react'

export function SettingsPage() {
    const [previewSettings, setPreviewSettings] = useState({
        primary_color: '#3B82F6',
        secondary_color: '#F97316',
        logo_url: null,
        banner_url: null,
        layout_type: 'grid'
    })

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Configuración</h1>
                <p className="text-muted-foreground font-medium">
                    Administra tu marca, perfil y la experiencia de tus clientes.
                </p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-muted/50 p-1 rounded-2xl">
                    <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                        <Building2 className="w-4 h-4 mr-2" /> Perfil
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                        <Palette className="w-4 h-4 mr-2" /> Personalizar Menú
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="animate-in fade-in-50 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <CompanyProfileForm />
                        </div>
                        <div className="space-y-4">
                            <TerminalAccessCard />
                            <Card className="border-none shadow-sm bg-primary/5 border-l-4 border-l-primary">
                                <CardHeader>
                                    <CardTitle className="text-sm">Consejo Pro</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Comparte la URL de tu terminal con tu equipo para que puedan acceder desde cualquier dispositivo con su PIN.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="appearance" className="animate-in fade-in-50 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                        {/* Form Section */}
                        <div className="order-2 lg:order-1">
                            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                                <Palette className="w-5 h-5 text-primary" />
                                Diseño del Menú Digital
                            </h2>
                            <MenuAppearanceForm onPreviewUpdate={setPreviewSettings} />
                        </div>

                        {/* Preview Section */}
                        <div className="order-1 lg:order-2 lg:sticky lg:top-24">
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-muted/50 rounded-full">
                                    <Smartphone className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Vista Previa en Tiempo Real</span>
                                </div>
                                <MobilePreview settings={previewSettings} />
                                <p className="mt-6 text-[11px] text-muted-foreground text-center max-w-[280px]">
                                    Esta es una simulación de cómo verán tus clientes el menú en sus dispositivos móviles.
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

