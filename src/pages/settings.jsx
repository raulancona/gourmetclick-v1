import { useState } from 'react'
import { CompanyProfileForm } from '../features/settings/company-profile-form'
import { MenuAppearanceForm } from '../features/settings/menu-appearance-form'
import { TerminalAccessCard } from '../features/settings/terminal-access-card'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Palette, Building2 } from 'lucide-react'

export function SettingsPage() {
    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Configuración</h1>
                <p className="text-muted-foreground font-medium">
                    Administra tu marca, perfil y la experiencia de tus clientes.
                </p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full max-w-sm grid-cols-2 mb-8 bg-muted/50 p-1 rounded-2xl">
                    <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                        <Building2 className="w-4 h-4 mr-2" /> Perfil
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all">
                        <Palette className="w-4 h-4 mr-2" /> Personalizar Menú
                    </TabsTrigger>
                </TabsList>

                {/* ── Profile Tab ── */}
                <TabsContent value="profile" className="animate-in fade-in-50 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <CompanyProfileForm />
                        </div>
                        <div className="space-y-4">
                            <TerminalAccessCard />
                            <Card className="border-none shadow-sm bg-primary/5">
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

                {/* ── Appearance Tab — MenuAppearanceForm has its own live preview ── */}
                <TabsContent value="appearance" className="animate-in fade-in-50 duration-500">
                    <MenuAppearanceForm />
                </TabsContent>
            </Tabs>
        </div>
    )
}
