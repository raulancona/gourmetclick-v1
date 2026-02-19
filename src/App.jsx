import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/auth-context'
import { TerminalProvider } from './features/auth/terminal-context'
import { ProtectedRoute } from './features/auth/protected-route'
import { DashboardLayout } from './features/dashboard/dashboard-layout'
import { DashboardPage } from './pages/dashboard'
import POSPage from './pages/pos'
import { OrdersPage } from './pages/orders'
import { ProductsPage } from './pages/products'
import { CategoriesPage } from './pages/categories'
import { ReportsPage } from './pages/reports'
import { SettingsPage } from './pages/settings'
import { LinkCardConfigPage as MenuLinksPage } from './pages/link-card-config'
import { LoginPage } from './pages/login'
import { RegisterPage } from './pages/register'
import { ThemeProvider } from './components/theme-provider'
import { CashClosingPage } from './pages/cash-closing'
import { ExpensesPage } from './pages/expenses'
import { StaffPage } from './pages/staff'
import { TerminalAccessPage } from './pages/terminal-access'
import { SessionGuard } from './features/cash-closing/session-guard'
import { TrackingPage } from './pages/tracking'
import { PublicMenuPage } from './pages/public-menu'
import { PublicLinkCardPage } from './pages/public-link-card'
import { Toaster } from 'sonner'

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="gc-theme">
      <BrowserRouter>
        <AuthProvider>
          <TerminalProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Operational Terminal */}
              <Route path="/terminal" element={<ProtectedRoute><TerminalAccessPage /></ProtectedRoute>} />

              {/* Admin/POS Layout */}
              <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />

                {/* Protected Financial Routes */}
                <Route path="pos" element={<SessionGuard><POSPage /></SessionGuard>} />
                <Route path="orders" element={<SessionGuard><OrdersPage /></SessionGuard>} />
                <Route path="expenses" element={<SessionGuard><ExpensesPage /></SessionGuard>} />

                <Route path="products" element={<ProductsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="caja" element={<CashClosingPage />} />
                <Route path="reportes" element={<ReportsPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="menu-links" element={<MenuLinksPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Public Routes (No Auth Required) */}
              <Route path="/rastreo/:tracking_id" element={<TrackingPage />} />
              <Route path="/menu/:slug" element={<PublicMenuPage />} />
              <Route path="/m/:slug" element={<PublicMenuPage />} />
              <Route path="/card/:slug" element={<PublicLinkCardPage />} />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </TerminalProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}

export default App
