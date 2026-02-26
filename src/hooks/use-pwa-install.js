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
    // Detección de iOS (iPad, iPhone, iPod)
    const [isIOS, setIsIOS] = useState(false)
    // Detección de si es Firefox
    const [isFirefox, setIsFirefox] = useState(false)
    // Si la App está siendo visualizada desde Safari (o browser en iOS)
    const [isSafari, setIsSafari] = useState(false)

    useEffect(() => {
        // Detectar si está instalado como PWA standalone
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true

        if (isStandalone) {
            setIsInstalled(true)
            return
        }

        // Detección de dispositivo iOS (incluso nuevos iPads que falsean MacOS)
        const ua = window.navigator.userAgent
        const isIOSDevice =
            /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

        setIsIOS(isIOSDevice)
        setIsFirefox(/firefox/i.test(ua))

        // Es Safari en iOS (para instrucciones en iOS) o Safari Desktop
        setIsSafari(/^((?!chrome|android).)*safari/i.test(ua))

        // Si es iOS, no esperamos el `beforeinstallprompt` (no existe en Safari iOS)
        if (isIOSDevice) {
            setIsInstallable(true)
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

    return {
        isInstallable,
        isInstalled,
        triggerInstall,
        isIOS,
        isFirefox,
        isSafari,
        // Helper para saber si la instalación será nativa (Android Chrome/Edge) 
        // o requiere pasos manuales (iOS Safari, Firefox, etc.)
        supportsNativePrompt: !!installPrompt
    }
}
