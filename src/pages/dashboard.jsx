import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getProductCount } from '../lib/product-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export function DashboardPage() {
    const { user } = useAuth()

    // Fetch product count
    const { data: productCount = 0, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['productCount', user?.id],
        queryFn: () => getProductCount(user.id),
        enabled: !!user?.id
    })

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Bienvenido a tu panel de control
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Cotizaciones</CardTitle>
                        <CardDescription>Total de cotizaciones creadas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">0</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Productos</CardTitle>
                        <CardDescription>Productos en catálogo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingProducts ? (
                            <div className="text-3xl font-bold text-gray-400">...</div>
                        ) : (
                            <div className="text-3xl font-bold">{productCount}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Clientes</CardTitle>
                        <CardDescription>Clientes únicos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">0</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
