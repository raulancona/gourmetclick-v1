import { RegisterForm } from '../features/auth/register-form'
import { UtensilsCrossed } from 'lucide-react'

export function RegisterPage() {
    return (
        <div className="flex min-h-screen w-full">
            {/* Branding Section (Hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 bg-zinc-900 relative items-center justify-center p-12 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-zinc-900/90 to-black/80"></div>

                <div className="relative z-10 text-center space-y-6 max-w-lg">
                    <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-[#d4af37] to-[#f3eacb] rounded-2xl flex items-center justify-center shadow-2xl shadow-[#d4af37]/20 rotate-3 border border-[#d4af37]/30">
                        <span className="text-4xl">🧑‍🍳</span>
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-5xl font-black text-white tracking-tight">Únete a <br /> Gourmet <span className="text-[#d4af37]">Click</span></h1>
                        <p className="text-zinc-400 text-lg leading-relaxed">
                            Comienza a transformar la gestión de tu restaurante hoy mismo. Eficiencia, control y elegancia en un solo lugar.
                        </p>
                    </div>
                </div>

                {/* Decorative gold circle */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#d4af37]/10 rounded-full blur-3xl"></div>
                <div className="absolute top-12 right-12 w-32 h-32 border border-[#d4af37]/20 rounded-full opacity-50"></div>
            </div>

            {/* Form Section */}
            <div className="flex-1 flex items-center justify-center bg-background p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="lg:hidden text-center mb-8">
                        <h1 className="text-3xl font-black text-foreground">Gourmet <span className="text-primary">Click</span></h1>
                    </div>

                    <RegisterForm />

                    <p className="text-center text-sm text-muted-foreground mt-8">
                        &copy; {new Date().getFullYear()} Gourmet Click. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    )
}
