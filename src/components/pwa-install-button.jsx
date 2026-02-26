import { useState } from 'react'
import { Download, X, CheckCircle2 } from 'lucide-react'
import { usePwaInstall } from '../hooks/use-pwa-install'

/**
 * Floating PWA install button with animated prompt.
 * Shows only when the browser fires the beforeinstallprompt event.
 */
export function PwaInstallButton() {
    const { isInstallable, isInstalled, triggerInstall } = usePwaInstall()
    const [dismissed, setDismissed] = useState(false)
    const [installing, setInstalling] = useState(false)
    const [success, setSuccess] = useState(false)

    if (isInstalled || dismissed || !isInstallable) return null

    const handleInstall = async () => {
        setInstalling(true)
        const accepted = await triggerInstall()
        setInstalling(false)
        if (accepted) {
            setSuccess(true)
            setTimeout(() => setDismissed(true), 2000)
        }
    }

    return (
        <div className="pwa-install-banner">
            <div className="pwa-install-icon-wrap">
                <img src="/pwa-icon.svg" alt="Gourmet Click" className="pwa-install-app-icon" />
            </div>

            <div className="pwa-install-text">
                <span className="pwa-install-title">Instalar Gourmet Click</span>
                <span className="pwa-install-subtitle">Acceso rápido desde tu pantalla de inicio</span>
            </div>

            <div className="pwa-install-actions">
                {success ? (
                    <div className="pwa-install-success">
                        <CheckCircle2 size={20} />
                        <span>¡Listo!</span>
                    </div>
                ) : (
                    <button
                        onClick={handleInstall}
                        disabled={installing}
                        className="pwa-install-btn"
                        aria-label="Instalar aplicación"
                    >
                        {installing ? (
                            <span className="pwa-install-spinner" />
                        ) : (
                            <>
                                <Download size={16} />
                                <span>Instalar</span>
                            </>
                        )}
                    </button>
                )}

                <button
                    onClick={() => setDismissed(true)}
                    className="pwa-install-dismiss"
                    aria-label="Cerrar"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    )
}
