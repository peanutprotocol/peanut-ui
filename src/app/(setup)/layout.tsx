'use client'

import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useEffect, useState, Suspense } from 'react'
import { setupScreenIds, setupSteps } from '../../components/Setup/Setup.consts'
import '../../styles/globals.css'
import Loading from '@/components/Global/Loading'
import { AppShell } from '@/components/Global/AppShell'
import { AttentionBanner } from '@/features/attention/AttentionBanner'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { usePullToRefresh, useShouldPullToRefresh } from '@/hooks/usePullToRefresh'
import { isCapacitor } from '@/utils/capacitor'
import { useResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { filterSetupStepsForCountry, filterSetupStepsForInvite } from '@/features/setup/filterSetupSteps'
import { setupCountrySuggestion } from '@/features/setup/country-signals'
import { useSetupCountrySignals } from '@/features/setup/useSetupCountrySignals'
import { useAuth } from '@/context/authContext'
import { readInviteCode } from '@/utils/invite-stash'

function SetupLayoutContent({ children }: { children?: React.ReactNode }) {
    const { setSteps, sellScreensCountry, inviterAccepted } = useSetupFlowContext()
    const residenceRestrictions = useResidenceRestrictionSets()
    const { user } = useAuth()
    const invitedBy = user?.invitedBy
    // The sell screens come before residence: they follow the signals' suggestion until
    // the account exists, then the country the page fixed at that point.
    const suggestedCountry = setupCountrySuggestion(useSetupCountrySignals())?.country ?? null
    const sellCountry = sellScreensCountry === undefined ? suggestedCountry : sellScreensCountry
    const { deviceType } = useDeviceType()

    /*
     * Bottom-inset fill color. The content directly above the bottom inset (iOS
     * home indicator / Android 15 edge-to-edge nav bar) is the setup flow's white
     * panel, so a hero-colored fill reads as a stray strip — fill with white on
     * every native build (both platforms) and on iOS browsers. State + effect
     * (not a render-time platform check) so the static
     * export's prerendered HTML hydrates cleanly.
     */
    const [bottomInsetFill, setBottomInsetFill] = useState('setup-hero-background')
    useEffect(() => {
        if (isCapacitor() || deviceType === DeviceType.IOS) setBottomInsetFill('bg-white')
    }, [deviceType])

    // configure status bar for native. Start at the setup blue; SetupWrapper
    // updates it to each step's tint after the color transition. On
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
                await StatusBar.setBackgroundColor({ color: '#90A8ED' }) // --color-background-setup-hero (blue-300); capacitor takes a literal
            })
            .catch(() => {})
    }, [])

    // The invite stash is read when the list is rebuilt, not watched. Registration
    // settles it, and fixing the sell-screen country on the first step after
    // registration rebuilds the list before the person can leave that step.
    useEffect(() => {
        const steps = filterSetupStepsForCountry(setupSteps, residenceRestrictions, sellCountry)
        setSteps(filterSetupStepsForInvite(steps, inviterAccepted || !!invitedBy || !!readInviteCode()))
    }, [setSteps, residenceRestrictions, sellCountry, invitedBy, inviterAccepted])

    usePullToRefresh({ shouldPullToRefresh: useShouldPullToRefresh() })

    return (
        <AppShell
            variant="onboarding"
            banner={<AttentionBanner />}
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
