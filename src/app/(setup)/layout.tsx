'use client'

import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, Suspense } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Banner } from '@/components/Global/Banner'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { isCapacitor } from '@/utils/capacitor'

function SetupLayoutContent({ children }: { children?: React.ReactNode }) {
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()
    const { deviceType } = useDeviceType()

    // configure status bar for native. the setup/onboarding flow has a periwinkle
    // top (illustration + feedback ribbon), so tint the status bar to match — on
    // pre-edge-to-edge Android the OS paints this color; on Android 15+ it's a
    // no-op (edge-to-edge forced) and the CSS safe zone below handles it.
    useEffect(() => {
        if (!isCapacitor()) return
        import('@capacitor/status-bar')
            .then(({ StatusBar, Style }) => {
                StatusBar.setOverlaysWebView({ overlay: false })
                StatusBar.setStyle({ style: Style.Light })
                StatusBar.setBackgroundColor({ color: '#90A8ED' }) // secondary-3
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            // Filter out pwa-install if already in PWA
            if (step.screenId === 'pwa-install' && isPWA) return false

            return true
        })
        dispatch(setupActions.setSteps(filteredSteps))

        // if ios and not in pwa, show ios pwa install screen after setup flow is completed
        if (deviceType === DeviceType.IOS && !isPWA) {
            dispatch(setupActions.setShowIosPwaInstallScreen(true))
        } else {
            dispatch(setupActions.setShowIosPwaInstallScreen(false))
        }
    }, [isPWA, deviceType])

    usePullToRefresh()

    return (
        <>
            {/* Status-bar safe zone + feedback ribbon.
                Android 15 (targetSdk 36) forces edge-to-edge, so the webview draws
                UNDER the status bar — without this the ribbon/status icons collide
                in a blank strip (see bug report). Fill the inset with the brand
                periwinkle (matches the onboarding illustration) so the top reads as
                intentional. env(safe-area-inset-top) resolves to 0 on web and on
                non-edge-to-edge Android, so this is a no-op there. */}
            <div className="bg-secondary-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                <Banner />
            </div>
            {children}
            {/* Bottom safe-area zone. Mirrors the periwinkle status-bar strip above:
                on Android 15 edge-to-edge the webview draws under the nav bar, where the
                page's beige (bg-background) would otherwise show. Fill the inset with the
                brand periwinkle so the bottom matches the top. No-op on web (inset = 0). */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 bg-secondary-3"
                style={{ height: 'env(safe-area-inset-bottom)' }}
            />
        </>
    )
}

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    return (
        <Suspense fallback={<PeanutLoading coverFullScreen />}>
            <SetupLayoutContent>{children}</SetupLayoutContent>
        </Suspense>
    )
}

export default SetupLayout
