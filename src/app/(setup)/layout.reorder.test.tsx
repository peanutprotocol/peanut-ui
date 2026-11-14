jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, render, waitFor } from '@testing-library/react'
import SetupLayout from './layout'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/components/Global/AppShell', () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/features/attention/AttentionBanner', () => ({ AttentionBanner: () => null }))
jest.mock('@/components/Global/SupportDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'ios' },
    useDeviceType: () => ({ deviceType: 'web' }),
}))
jest.mock('@/hooks/usePullToRefresh', () => ({ usePullToRefresh: jest.fn(), useShouldPullToRefresh: () => false }))
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({ useResidenceRestrictionSets: () => null }))
jest.mock('@/features/setup/useSetupCountrySignals', () => ({
    useSetupCountrySignals: () => ({ vercelIpCountry: null, ipCountry: null }),
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
let context: ReturnType<typeof useSetupFlowContext>
function Probe() {
    context = useSetupFlowContext()
    return null
}

it('hides Invite when a new link is stashed after the runtime sell-screen list froze', async () => {
    localStorage.clear()
    render(
        <SetupLayout>
            <Probe />
        </SetupLayout>
    )
    await waitFor(() => expect(context.steps.some((step) => step.screenId === 'invite')).toBe(true))
    await act(async () => context.setFeatureScreenIds(['advantage-fees', 'advantage-card']))
    await act(async () => stashInvite('alice', EInviteType.DIRECT))
    await waitFor(() => expect(context.steps.some((step) => step.screenId === 'invite')).toBe(false))
    expect(context.steps.some((step) => step.screenId === 'passkey')).toBe(true)
})
