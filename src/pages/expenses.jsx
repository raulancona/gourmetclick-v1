import { ExpenseManager } from '../features/expenses/expense-manager'

export function ExpensesPage() {
    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Gestión de Gastos</h1>
                <p className="text-muted-foreground font-medium">Control de salidas de caja y gastos operativos diarios</p>
            </div>

            <ExpenseManager />
        </div>
    )
}
