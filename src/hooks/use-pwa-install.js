import { useState, useEffect } from 'react'

/**
 * Hook to manage PWA installation prompt.
 * Captures the browser's beforeinstallprompt event so we can trigger it
 * at an appropriate moment with a custom UI button.
 */
export function usePwaInstall() {
    const [installPrompt, setInstallPrompt] = useState(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isInstallable, setIsInstallable] = useState(false)

    useEffect(() => {
        // Check if already running as installed PWA
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true

        if (isStandalone) {
            setIsInstalled(true)
            return
        }

        const handler = (e) => {
            e.preventDefault()
            setInstallPrompt(e)
            setIsInstallable(true)
        }

        window.addEventListener('beforeinstallprompt', handler)

        window.addEventListener('appinstalled', () => {
            setIsInstalled(true)
            setIsInstallable(false)
            setInstallPrompt(null)
        })

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const triggerInstall = async () => {
        if (!installPrompt) return false
        installPrompt.prompt()
        const { outcome } = await installPrompt.userChoice
        if (outcome === 'accepted') {
            setIsInstalled(true)
            setIsInstallable(false)
            setInstallPrompt(null)
        }
        return outcome === 'accepted'
    }

    return { isInstallable, isInstalled, triggerInstall }
}
