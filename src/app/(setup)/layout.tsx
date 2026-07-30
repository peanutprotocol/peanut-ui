'use client'

import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useState, Suspense } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Banner } from '@/components/Global/Banner'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import SunsetScreen from '@/components/Migration/SunsetScreen'
import { KEEP_WEB_COOKIE, KEEP_WEB_TOKEN, MIGRATION_CUTOVER_DATE } from '@/constants/migration.consts'
import { isCapacitor } from '@/utils/capacitor'
import { getFromCookie } from '@/utils/general.utils'

function SetupLayoutContent({ children }: { children?: React.ReactNode }) {
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()
    const { deviceType } = useDeviceType()
    const migrationOn = useMigrationFlag()

    /*
     * Bottom-inset fill color. Periwinkle is for Android 15 edge-to-edge (matches
     * the status-bar strip). On iOS the content directly above the home-indicator
     * inset is the white panel, so periwinkle reads as a stray bar on Face ID
     * devices — fill with white there instead. This applies to ALL iOS (native
     * app, home-screen PWA, and Safari), not just the Capacitor native build, so
     * key off the device type rather than isIOSNative(). State + effect (not a
     * render-time platform check) so the static export's prerendered HTML hydrates
     * cleanly.
     */
    const [bottomInsetFill, setBottomInsetFill] = useState('bg-secondary-3')
    useEffect(() => {
        if (deviceType === DeviceType.IOS) setBottomInsetFill('bg-white')
    }, [deviceType])

    // configure status bar for native. the setup/onboarding flow has a periwinkle
    // top (illustration + feedback ribbon), so tint the status bar to match — on
    // pre-edge-to-edge Android the OS paints this color; on Android 15+ it's a
    // no-op (edge-to-edge forced) and the CSS safe zone below handles it.
    useEffect(() => {
        if (!isCapacitor()) return
        import('@capacitor/status-bar')
            .then(async ({ StatusBar, Style }) => {
                // await so rejections (e.g. plugin missing in older native
                // binaries that got this bundle via OTA update) hit the catch
                // below instead of surfacing as unhandled rejections in Sentry
                await StatusBar.setOverlaysWebView({ overlay: false })
                await StatusBar.setStyle({ style: Style.Light })
                await StatusBar.setBackgroundColor({ color: '#90A8ED' }) // secondary-3
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            // pwa-sunset notice window: stop onboarding new users into the PWA —
            // the InstallPWA screens go away, store links show on the landing
            // step instead (TASK-20830 / TASK-20600)
            if (
                migrationOn &&
                ['pwa-install', 'android-initial-pwa-install', 'unsupported-browser'].includes(step.screenId)
            ) {
                return false
            }
            // Filter out pwa-install if already in PWA
            if (step.screenId === 'pwa-install' && isPWA) return false

            return true
        })
        dispatch(setupActions.setSteps(filteredSteps))

        // if ios and not in pwa, show ios pwa install screen after setup flow is completed
        // (retired during the migration window — the app download replaces the PWA)
        if (!migrationOn && deviceType === DeviceType.IOS && !isPWA) {
            dispatch(setupActions.setShowIosPwaInstallScreen(true))
        } else {
            dispatch(setupActions.setShowIosPwaInstallScreen(false))
        }
    }, [isPWA, deviceType, dispatch, migrationOn])

    usePullToRefresh()

    // pwa-sunset: past the cutover the web signup is switched off too — same
    // block as the mobile-ui layout (this route group has its own layout, so
    // it needs its own gate). keep-web cookie bypasses.
    if (
        migrationOn &&
        !isCapacitor() &&
        Date.now() >= MIGRATION_CUTOVER_DATE.getTime() &&
        getFromCookie(KEEP_WEB_COOKIE) !== KEEP_WEB_TOKEN
    ) {
        return <SunsetScreen />
    }

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
                className={`pointer-events-none fixed inset-x-0 bottom-0 -z-10 ${bottomInsetFill}`}
                style={{ height: 'env(safe-area-inset-bottom)' }}
            />
            <SupportDrawer />
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
