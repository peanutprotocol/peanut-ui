import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import JoinWaitlistPage from './JoinWaitlistPage'

const mockAcceptInvite = jest.fn()
const mockFetchUser = jest.fn()
const mockRemoveFromCookie = jest.fn()
const mockSetStep = jest.fn()
const mockSettleAcceptedInviteAcquisition = jest.fn()
const mockCapture = jest.fn()

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1', email: 'member@example.com' } },
        fetchUser: mockFetchUser,
        isFetchingUser: false,
        logoutUser: jest.fn(),
    }),
}))

jest.mock('@/services/invites', () => ({
    invitesApi: {
        acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
        validateInviteCode: jest.fn(),
        getWaitlistQueuePosition: jest.fn(),
    },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: (...args: unknown[]) => mockSettleAcceptedInviteAcquisition(...args),
}))

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: { success: true, position: 7 }, isLoading: false }),
}))
jest.mock('@/redux/hooks', () => ({
    useSetupStore: () => ({ inviteType: 'PAYMENT_LINK', inviteCode: '' }),
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        requestPermission: jest.fn(),
        afterPermissionAttempt: jest.fn(),
        isPermissionGranted: true,
    }),
}))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('nuqs', () => ({
    useQueryState: () => ['jail', mockSetStep],
    parseAsStringEnum: () => ({ withDefault: () => ({}) }),
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: () => null,
    removeFromCookie: (...args: unknown[]) => mockRemoveFromCookie(...args),
    toInviteCode: (value: string) => value.trim().toLowerCase(),
}))
jest.mock('@/utils/format.utils', () => ({ isValidEmail: () => true }))
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))
jest.mock('@/assets/mascot', () => ({
    PeanutWavingHello: { src: '/waving.svg' },
    PeanutPointing: { src: '/pointing.svg' },
}))
jest.mock('./InvitesPageLayout', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('../Global/ValidatedInput', () => ({
    __esModule: true,
    default: ({
        onUpdate,
    }: {
        onUpdate: (value: { value: string; isValid: boolean; isChanging: boolean }) => void
    }) => (
        <button type="button" onClick={() => onUpdate({ value: 'offramp', isValid: true, isChanging: false })}>
            Enter legacy code
        </button>
    ),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children: React.ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button type="button" onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('../Global/ErrorAlert', () => ({
    __esModule: true,
    default: ({ description }: { description: string }) => <div>{description}</div>,
}))
jest.mock('../Global/Loading', () => ({
    __esModule: true,
    default: (props: any) => (props.variant === 'mascot' ? <div>Loading</div> : <div data-testid="loading-spinner" />),
}))
jest.mock('@/components/0_Bruddle/BaseInput', () => ({ BaseInput: () => <input /> }))

describe('JoinWaitlistPage invite onboarding boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        sessionStorage.clear()
        mockSettleAcceptedInviteAcquisition.mockReturnValue({ destination: '/home', pending: [] })
    })

    it.each([
        ['awarded', true],
        ['already_owned', true],
        ['inactive', false],
        ['expired', false],
        ['unknown', false],
    ] as const)(
        'settles a terminal %s campaign-only response and refreshes only confirmed possession',
        async (outcome, shouldRefresh) => {
            mockAcceptInvite.mockResolvedValue({
                success: true,
                attributionResolved: false,
                onboardingResolved: false,
                legacyAcquisition: {
                    campaignTag: 'offramp',
                    fallback: 'normal_app',
                    destination: 'offramp_migration',
                },
                claims: [{ badgeCampaign: 'offramp', badgeCode: 'OFFRAMP_USER', outcome }],
            })

            render(<JoinWaitlistPage />)
            fireEvent.click(screen.getByRole('button', { name: 'Enter legacy code' }))
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith('offramp', 'PAYMENT_LINK'))
            expect(mockSettleAcceptedInviteAcquisition).toHaveBeenCalledWith(
                expect.objectContaining({ campaignTag: 'offramp' }),
                [expect.objectContaining({ badgeCampaign: 'offramp', badgeCode: 'OFFRAMP_USER', outcome })]
            )
            expect(sessionStorage.getItem('showNoMoreJailModal')).toBeNull()
            expect(mockRemoveFromCookie).toHaveBeenCalledWith('inviteCode')
            if (shouldRefresh) expect(mockFetchUser).toHaveBeenCalledTimes(1)
            else expect(mockFetchUser).not.toHaveBeenCalled()
            expect(screen.queryByText('Something went wrong. Please try again or contact support.')).toBeNull()
            expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPTED, expect.anything())
            expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, expect.anything())
        }
    )
})
