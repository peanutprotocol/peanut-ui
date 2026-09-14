'use client'

import { getShakeClass } from '@/utils/perk.utils'
import { useQrClaimFlow } from './useQrClaimFlow'
import { QrClaimLoadingView } from './views/QrClaimLoadingView'
import { QrClaimUnavailableView } from './views/QrClaimUnavailableView'
import { QrClaimView } from './views/QrClaimView'

export function QrClaimPage() {
    const { user, redirectQrData, isCheckingStatus, redirectQrError, isLoading, error, shake, setShake, handleClaim } =
        useQrClaimFlow()

    const shakeClass = getShakeClass(shake.on, shake.intensity)

    // Show loading while checking status or if we're in the process of redirecting
    if (isCheckingStatus || (redirectQrData?.claimed && redirectQrData?.redirectUrl)) {
        return <QrClaimLoadingView shakeClass={shakeClass} />
    }

    // If not logged in and QR is unclaimed, the useEffect in the flow hook will redirect to setup
    // This loading screen will show briefly during that redirect
    if (!user) {
        return <QrClaimLoadingView shakeClass={shakeClass} />
    }

    // Show error only if there's an actual error or QR is not available (and not claimed)
    if (redirectQrError || !redirectQrData || (!redirectQrData.available && !redirectQrData.claimed)) {
        // Log error for debugging but don't expose details to user
        if (redirectQrError) {
            console.error('QR status check error:', redirectQrError)
        }
        return <QrClaimUnavailableView shakeClass={shakeClass} alreadyClaimed={!!redirectQrData?.claimed} />
    }

    return (
        <QrClaimView
            shakeClass={shakeClass}
            isLoading={isLoading}
            error={error}
            onClaim={handleClaim}
            onShakeChange={(on, intensity) => setShake({ on, intensity })}
        />
    )
}
