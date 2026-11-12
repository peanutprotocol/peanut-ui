/** @jest-environment jsdom */
import { render } from '@testing-library/react'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import { EInviteType } from '@/services/services.types'
import { stashAcquisitionInvite, stashInvite } from '@/utils/invite-stash'
import SetupLayout from '../layout'

const mockSetSteps = jest.fn<void, [ISetupStep[]]>()
jest.mock('@/features/setup/SetupFlowContext', () => ({
    SetupFlowProvider: ({ children }: { children: React.ReactNode }) => children,
    useSetupFlowContext: () => ({ setSteps: mockSetSteps, sellScreensCountry: null, inviterAccepted: false }),
}))
jest.mock('@/components/Global/AppShell', () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/features/attention/AttentionBanner', () => ({ AttentionBanner: () => null }))
jest.mock('@/components/Global/SupportDrawer', () => () => null)
jest.mock('@/components/Global/Loading', () => () => null)
jest.mock('@/hooks/usePullToRefresh', () => ({ usePullToRefresh: () => {}, useShouldPullToRefresh: () => false }))
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({ useResidenceRestrictionSets: () => null }))
jest.mock('@/features/setup/useSetupCountrySignals', () => ({ useSetupCountrySignals: () => null }))
jest.mock('@/features/setup/country-signals', () => ({ setupCountrySuggestion: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'ios' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))

const invitePresent = () => mockSetSteps.mock.calls.at(-1)![0].some((step) => step.screenId === 'invite')

beforeEach(() => {
    localStorage.clear()
    mockSetSteps.mockClear()
})

it('keeps the invite step for a passive tracked-link inviter', () => {
    stashAcquisitionInvite('creator')
    render(<SetupLayout />)
    expect(invitePresent()).toBe(true)
})

it('hides the invite step for an invite the visitor chose', () => {
    stashInvite('friend', EInviteType.DIRECT)
    render(<SetupLayout />)
    expect(invitePresent()).toBe(false)
})
