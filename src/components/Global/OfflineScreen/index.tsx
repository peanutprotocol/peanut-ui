'use client'

import { Button } from '@/components/0_Bruddle/Button'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_ANIMATION_LOADERS, MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import { verifyConnectivity } from '@/hooks/useNetworkStatus'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

const OFFLINE_POSE: MascotPose = 'worried'

// This screen only shows once the connection is gone, when the mascot's lazy chunks can no longer be fetched.
// Fetch them while still online, shortly after the app shell loads, so the worried peanut is there when needed.
if (typeof window !== 'undefined') {
    window.setTimeout(() => {
        void Promise.all([
            import('lottie-web/build/player/lottie_light'),
            MASCOT_ANIMATION_LOADERS[OFFLINE_POSE](),
        ]).catch(() => {})
    }, 5000)
}

/**
 * full-page offline screen shown when user loses internet connection
 * displays the worried peanut and a retry action
 * when connection is restored, page automatically reloads
 */
export default function OfflineScreen() {
    const t = useTranslations('global')
    const [isChecking, setIsChecking] = useState(false)

    // verify with a real fetch instead of trusting navigator.onLine
    const handleRetryConnection = async () => {
        setIsChecking(true)
        const online = await verifyConnectivity()
        if (online) {
            window.location.reload()
        } else {
            setIsChecking(false)
        }
    }

    return (
        <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background-page p-6">
            <PeanutMascot pose={OFFLINE_POSE} className={MASCOT_STATE_CLASS} />
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-heading-s">{t('offlineScreen.title')}</h1>
                <p className="max-w-md text-body-s">{t('offlineScreen.description')}</p>
            </div>
            <Button
                shadowSize="4"
                icon="retry"
                size="medium"
                className="w-fit rounded-full"
                onClick={handleRetryConnection}
                disabled={isChecking}
            >
                {isChecking ? t('offlineScreen.checking') : t('offlineScreen.checkConnection')}
            </Button>
        </div>
    )
}
