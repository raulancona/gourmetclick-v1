import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/auth-context'
import { ProtectedRoute } from './features/auth/protected-route'
import { DashboardLayout } from './features/dashboard/dashboard-layout'
import { LoginPage } from './pages/login'
import { RegisterPage } from './pages/register'
import { DashboardPage } from './pages/dashboard'
import { SettingsPage } from './pages/settings'
import { ProductsPage } from './pages/products'
import { CategoriesPage } from './pages/categories'
import { PublicMenuPage } from './pages/public-menu'
import { Toaster } from 'sonner'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public menu route - NO AUTH REQUIRED */}
          <Route path="/m/:slug" element={<PublicMenuPage />} />

          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  )
}

export default App
