'use client'

import { usePWAStatus } from '@/hooks/usePWAStatus'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useRef, useState, Suspense } from 'react'
import { setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Banner } from '@/components/Global/Banner'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import SunsetScreen from '@/components/Migration/SunsetScreen'
import { isPwaSunsetOn, shouldShowSunsetBlock } from '@/utils/migration.utils'
import { isCapacitor } from '@/utils/capacitor'

function SetupLayoutContent({ children }: { children?: React.ReactNode }) {
    const dispatch = useAppDispatch()
    const isPWA = usePWAStatus()
    const { deviceType } = useDeviceType()
    const migrationOn = useMigrationFlag()
    const hasKeepWebBypass = useKeepWebBypass()

    /*
     * Bottom-inset fill color. The content directly above the bottom inset (iOS
     * home indicator / Android 15 edge-to-edge nav bar) is the setup flow's white
     * panel, so a periwinkle fill reads as a stray strip — fill with white on
     * every native build (both platforms) AND on all iOS device types (native,
     * home-screen PWA, Safari — the Face ID home-indicator bar is the same in
     * each). State + effect (not a render-time platform check) so the static
     * export's prerendered HTML hydrates cleanly.
     */
    const [bottomInsetFill, setBottomInsetFill] = useState('bg-secondary-3')
    useEffect(() => {
        if (isCapacitor() || deviceType === DeviceType.IOS) setBottomInsetFill('bg-white')
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

    // Latched ONCE at the first effect run instead of reacting to the async
    // PostHog flag load: a mid-load true-flip would re-dispatch setSteps, whose
    // new identity re-runs determineInitialStep and yanks a mid-flow user back
    // to the landing step (losing e.g. a typed username). Returning visitors
    // read the cached flag correctly; only first-ever visitors in the seconds
    // before flags cache get the legacy flow — acceptable transitional cohort.
    const migrationOnAtEntry = useRef<boolean | null>(null)

    useEffect(() => {
        if (migrationOnAtEntry.current === null) {
            migrationOnAtEntry.current = isPwaSunsetOn()
        }
        const migrationSteps = migrationOnAtEntry.current

        // filter steps and set them in redux state
        const filteredSteps = setupSteps.filter((step) => {
            // pwa-sunset notice window: stop onboarding new users into the PWA —
            // the InstallPWA screens go away, store links show on the landing
            // step instead (TASK-20830 / TASK-20600)
            if (
                migrationSteps &&
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
        if (!migrationSteps && deviceType === DeviceType.IOS && !isPWA) {
            dispatch(setupActions.setShowIosPwaInstallScreen(true))
        } else {
            dispatch(setupActions.setShowIosPwaInstallScreen(false))
        }
    }, [isPWA, deviceType, dispatch])

    usePullToRefresh()

    // pwa-sunset: past the cutover the web signup is switched off too — same
    // block as the mobile-ui layout (this route group has its own layout, so
    // it needs its own gate). keep-web cookie/param bypasses.
    if (shouldShowSunsetBlock({ migrationOn, hasKeepWebBypass })) {
        return <SunsetScreen />
    }

    return (
        <>
            {/* Status-bar safe zone + feedback ribbon.
                Android 15 (targetSdk 36) forces edge-to-edge, so the webview draws
                UNDER the status bar — without this the ribbon/status icons collide
                in a blank strip (see bug report). Fill the inset with the brand
                periwinkle (matches the onboarding illustration) so the top reads as
                intentional. --safe-top resolves to env(), which is 0 on web and on
                non-edge-to-edge Android, so this is a no-op there. */}
            <div className="bg-secondary-3 pt-safe-top">
                <Banner />
            </div>
            {children}
            {/* Bottom safe-area zone. Mirrors the periwinkle status-bar strip above:
                on Android 15 edge-to-edge the webview draws under the nav bar, where the
                page's beige (bg-background) would otherwise show. Fill the inset with the
                brand periwinkle so the bottom matches the top. No-op on web (inset = 0). */}
            <div
                aria-hidden
                className={`pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-safe-bottom ${bottomInsetFill}`}
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
