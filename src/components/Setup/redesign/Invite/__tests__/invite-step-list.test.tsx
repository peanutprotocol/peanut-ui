/** @jest-environment jsdom */
/*
 * 04 Invite: when the step is in the list the setup layout builds (contract P2 § 4 b8, checks P2-05, P2-06).
 * The layout is dev's, unchanged; these guard that the redesign keeps the rule.
 */
import { render } from '@testing-library/react'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import { EInviteType } from '@/services/services.types'
import { stashAcquisitionInvite, stashInvite } from '@/utils/invite-stash'
import SetupLayout from '@/app/(setup)/layout'

const mockSetSteps = jest.fn<void, [ISetupStep[]]>()
let mockInviterAccepted = false
let mockUser: { user: { userId: string; username: string | null }; invitedBy: string | null } | null = null

jest.mock('@/features/setup/SetupFlowContext', () => ({
    SetupFlowProvider: ({ children }: { children: React.ReactNode }) => children,
    useSetupFlowContext: () => ({
        setSteps: mockSetSteps,
        sellScreensCountry: null,
        inviterAccepted: mockInviterAccepted,
        featureScreenIds: null,
        registrationInProgress: false,
    }),
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
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'ios' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))

const builtIds = () => mockSetSteps.mock.calls.at(-1)![0].map((step) => step.screenId)

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    mockSetSteps.mockClear()
    mockInviterAccepted = false
    mockUser = null
})

describe('04 Invite: in or out of the step list', () => {
    it('P2-05 an invite the visitor chose (intent explicit) removes invite from the list', () => {
        stashInvite('friend', EInviteType.DIRECT)
        render(<SetupLayout />)
        expect(builtIds()).not.toContain('invite')
        expect(builtIds()).toContain('passkey')
    })

    it('P2-05 an inviter already accepted removes invite from the list', () => {
        mockInviterAccepted = true
        render(<SetupLayout />)
        expect(builtIds()).not.toContain('invite')
    })

    it('P2-05 an account that already has invitedBy removes invite from the list', () => {
        // mid-registration account (no username yet), so this is not the registered-recovery path
        mockUser = { user: { userId: 'u1', username: null }, invitedBy: 'friend' }
        render(<SetupLayout />)
        expect(builtIds()).not.toContain('invite')
    })

    it('P2-06 only a tracked-link inviter (stashAcquisitionInvite) keeps invite between signup and passkey', () => {
        stashAcquisitionInvite('creator')
        render(<SetupLayout />)
        const ids = builtIds()
        expect(ids).toContain('invite')
        expect(ids.indexOf('signup')).toBeLessThan(ids.indexOf('invite'))
        expect(ids.indexOf('invite')).toBeLessThan(ids.indexOf('passkey'))
    })
})
