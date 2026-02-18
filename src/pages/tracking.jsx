import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CheckCircle2, Clock, ChefHat, Package, Check, Loader2, Truck, Sun, Moon } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { useTheme } from '../components/theme-provider'
import { Button } from '../components/ui/button'

export function TrackingPage() {
    const { tracking_id } = useParams()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        if (!tracking_id) return

        const fetchOrder = async () => {
            try {
                setLoading(true)
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('tracking_id', tracking_id)
                    .single()

                if (error) throw error
                setOrder(data)
            } catch (err) {
                console.error('Error fetching order:', err)
                setError('No pudimos encontrar tu pedido. Por favor verifica el enlace.')
            } finally {
                setLoading(false)
            }
        }

        fetchOrder()

        // Realtime Subscription
        const channel = supabase
            .channel(`order-${tracking_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `tracking_id=eq.${tracking_id}`
                },
                (payload) => {
                    console.log('Realtime update for tracking:', payload)
                    if (payload.new) {
                        setOrder(payload.new)
                    }
                }
            )
            .subscribe((status) => {
                console.log('Tracking subscription status:', status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [tracking_id])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
                <div className="max-w-md">
                    <h1 className="text-2xl font-bold text-foreground mb-2">¡Ups!</h1>
                    <p className="text-muted-foreground">{error || 'Pedido no encontrado'}</p>
                </div>
            </div>
        )
    }

    // Map database statuses to visual steps
    const getStepIndex = (status) => {
        switch (status) {
            case 'pending':
            case 'confirmed':
                return 0
            case 'preparing':
                return 1
            case 'ready':
                return 2
            case 'on_the_way':
                return 3
            case 'delivered':
                return 4
            default:
                return -1
        }
    }

    const steps = [
        { label: 'Recibido', icon: Clock, description: 'Hemos recibido tu orden' },
        { label: 'En preparación', icon: ChefHat, description: 'Cocinando tus alimentos' },
        { label: 'Listo', icon: Package, description: 'Tu pedido está listo' },
        { label: 'En camino', icon: Truck, description: 'Va en camino a tu dirección' },
        { label: 'Entregado', icon: CheckCircle2, description: 'Orden completada' }
    ]

    const currentStepIndex = getStepIndex(order.status)

    return (
        <div className="min-h-screen bg-muted/30 py-12 px-6">
            <div className="absolute top-4 right-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="rounded-full bg-card/50 backdrop-blur-sm border border-border shadow-sm hover:bg-card"
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
            </div>

            <div className="max-w-xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Seguimiento de Pedido</h1>
                    <p className="text-muted-foreground">Orden #{order.id.slice(0, 8)}</p>
                </div>

                {/* Status Card */}
                <div className="bg-card rounded-3xl p-8 shadow-sm border border-border mb-8">
                    {order.status === 'ready' && (
                        <div className="mb-8 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 animate-bounce">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0">
                                <Check className="w-6 h-6" />
                            </div>
                            <p className="text-green-600 dark:text-green-400 font-bold">¡Tu pedido está listo! Pasa por él o espera al repartidor.</p>
                        </div>
                    )}

                    <div className="space-y-8 relative">
                        {/* Connecting Line Background */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-1 bg-muted -z-10" />

                        {steps.map((step, index) => {
                            const Icon = step.icon
                            const isCompleted = index <= currentStepIndex
                            const isCurrent = index === currentStepIndex

                            // Skip "En camino" if it's not relevant (e.g., dine_in or pickup) AND we are not currently in that state
                            // But for simplicity, we show standard flow. Could hide 'on_the_way' if order_type is not delivery.
                            if (step.label === 'En camino' && order.order_type !== 'delivery' && index !== currentStepIndex) {
                                return null
                            }

                            return (
                                <div key={index} className="flex items-start gap-4 bg-transparent select-none">
                                    <div className="flex flex-col items-center">
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-4 z-10
                                            ${isCompleted
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-card text-muted-foreground border-muted'}
                                            ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}
                                        `}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className={`pt-2 transition-all duration-500 ${isCompleted ? 'opacity-100' : 'opacity-50'}`}>
                                        <h3 className={`font-bold text-lg leading-none ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step.label}
                                        </h3>
                                        {isCurrent && (
                                            <p className="text-sm text-primary font-medium mt-1 animate-pulse">
                                                {step.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Details Card */}
                <div className="bg-card rounded-3xl p-8 shadow-sm border border-border">
                    <h2 className="text-lg font-bold text-foreground mb-4">Detalles del Pedido</h2>
                    <div className="space-y-3">
                        {order.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    <span className="font-bold text-foreground">{item.quantity}x</span> {item.name}
                                </span>
                                <span className="font-medium text-foreground">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        ))}
                        <div className="pt-4 border-t border-border flex justify-between font-bold text-lg text-foreground">
                            <span>Total</span>
                            <span>{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
