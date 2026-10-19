'use client'

import { useNativePlatform } from '@/utils/native-platform'

import { SumsubNativeSdk } from './SumsubNativeSdk'
import { SumsubWebSdkModal } from './SumsubWebSdkModal'
import type { SumsubSdkProps } from './sumsubSdk.types'
import { useAuth } from '@/context/authContext'
import { useEffect, useState } from 'react'

/**
 * Every KYC entry point funnels through here, so this is the one place that
 * knows which Sumsub SDK to drive. Native gets the Cordova SDK: the WebSDK does
 * run inside the Capacitor WebView, but a Sumsub-side init failure there paints
 * their "Initialization error" screen inside a cross-origin iframe, silent to
 * every handler and every reporter we have. The WebSDK is used on native only
 * for action steps the Cordova SDK rejects as unsupported (e.g. APPLICANT_DATA).
 */
export const SumsubKycWrapper = (props: SumsubSdkProps) => {
    const nativePlatform = useNativePlatform()
    const [webFallback, setWebFallback] = useState<{ sessionKey?: string } | null>(null)
    useEffect(() => {
        if (!props.visible) setWebFallback(null)
    }, [props.visible])

    const { user } = useAuth()
    const email = (props.email ?? user?.user.email)?.trim() || undefined
    if (!nativePlatform.isHydrated) return null
    if (nativePlatform.isCapacitor && !(webFallback && webFallback.sessionKey === props.sessionKey)) {
        return (
            <SumsubNativeSdk
                {...props}
                email={email}
                onError={(error) => {
                    const message = error instanceof Error ? error.message : String(error)
                    if (/Step \S+ is NOT supported in actions\b/.test(message)) {
                        setWebFallback({ sessionKey: props.sessionKey })
                        return
                    }
                    props.onError?.(error)
                }}
            />
        )
    }
    return <SumsubWebSdkModal {...props} email={email} />
}
