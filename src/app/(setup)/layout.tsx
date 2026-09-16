'use client'

import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useEffect, useState, Suspense } from 'react'
import { setupScreenIds, setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import Loading from '@/components/Global/Loading'
import { AppShell } from '@/components/Global/AppShell'
import { Banner } from '@/components/Global/Banner'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { usePullToRefresh, useShouldPullToRefresh } from '@/hooks/usePullToRefresh'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import SunsetScreen from '@/components/Migration/SunsetScreen'
import { shouldShowSunsetBlock } from '@/utils/migration.utils'
import { isCapacitor } from '@/utils/capacitor'

function SetupLayoutContent({ children }: { children?: React.ReactNode }) {
    const { setSteps } = useSetupFlowContext()
    const { deviceType } = useDeviceType()
    const migrationOn = useMigrationFlag()
    const hasKeepWebBypass = useKeepWebBypass()

    /*
     * Bottom-inset fill color. The content directly above the bottom inset (iOS
     * home indicator / Android 15 edge-to-edge nav bar) is the setup flow's white
     * panel, so a periwinkle fill reads as a stray strip — fill with white on
     * every native build (both platforms) and on iOS browsers. State + effect
     * (not a render-time platform check) so the static
     * export's prerendered HTML hydrates cleanly.
     */
    const [bottomInsetFill, setBottomInsetFill] = useState('bg-blue-300')
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
                await StatusBar.setBackgroundColor({ color: '#90A8ED' }) // blue-300 (--color-blue-300); capacitor takes a literal
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        setSteps(setupSteps)
    }, [setSteps])

    usePullToRefresh({ shouldPullToRefresh: useShouldPullToRefresh() })

    // Past the cutover, web signup is switched off too. Use the same
    // block as the mobile-ui layout (this route group has its own layout, so
    // it needs its own gate). keep-web cookie/param bypasses.
    if (shouldShowSunsetBlock({ migrationOn, hasKeepWebBypass })) {
        return <SunsetScreen />
    }

    return (
        <AppShell
            variant="onboarding"
            banner={<Banner />}
            bottomInsetClassName={bottomInsetFill}
            modals={<SupportDrawer />}
        >
            {children}
        </AppShell>
    )
}

const SetupLayout = ({ children }: { children?: React.ReactNode }) => {
    return (
        <SetupFlowProvider masterScreenIds={setupScreenIds}>
            <Suspense fallback={<Loading variant="mascot" coverFullScreen />}>
                <SetupLayoutContent>{children}</SetupLayoutContent>
            </Suspense>
        </SetupFlowProvider>
    )
}

export default SetupLayout
