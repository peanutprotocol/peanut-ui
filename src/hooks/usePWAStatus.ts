import { useEffect, useState } from 'react'

export const usePWAStatus = () => {
    const [isPWA, setIsPWA] = useState(false)

    useEffect(() => {
        // Check if the app is running in standalone mode (PWA)
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://') ||
            window.location.href.includes('?mode=pwa')

        setIsPWA(isStandalone)

        // Listen for changes in display mode
        const mediaQuery = window.matchMedia('(display-mode: standalone)')
        const handleChange = (e: MediaQueryListEvent) => setIsPWA(e.matches)

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    return isPWA
}
