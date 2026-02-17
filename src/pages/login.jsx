import { LoginForm } from '../features/auth/login-form'

export function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <LoginForm />
        </div>
    )
}
