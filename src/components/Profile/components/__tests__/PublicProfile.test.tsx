import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import posthog from 'posthog-js'
import PublicProfile from '../PublicProfile'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { __testing as safeBackTesting } from '@/hooks/useSafeBack'
import en from '@/i18n/app/messages/en.json'

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockStashInvite = jest.fn()
const mockGetByUsername = jest.fn()
const mockValidateInviteCode = jest.fn()
const mockInterceptGuestCta = jest.fn(() => false)
const mockUseUserInteractions = jest.fn()
let mockAuth: { user: null | { user: { username: string; hasAppAccess: boolean } }; isFetchingUser: boolean }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/services/users', () => ({ usersApi: { getByUsername: (u: string) => mockGetByUsername(u) } }))
jest.mock('@/hooks/useUserInteractions', () => ({
    useUserInteractions: (ids: string[]) => mockUseUserInteractions(ids),
}))
jest.mock('@/services/invites', () => ({
    invitesApi: { validateInviteCode: (c: string) => mockValidateInviteCode(c) },
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({
        interceptGuestCta: () => mockInterceptGuestCta(),
        storeHandoffModal: <div data-testid="store-handoff" />,
    }),
}))
jest.mock('@/utils/invite-stash', () => ({
    stashInvite: (...args: unknown[]) => mockStashInvite(...args),
}))
jest.mock('@/utils/general.utils', () => {
    const actual = jest.requireActual('@/utils/general.utils')
    return { ...actual }
})
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// Stubbed neighbours — this suite is about the guest door, back navigation and
// the prior-transfer indicator, not the page furniture.
jest.mock('../ProfileHeader', () => ({
    __esModule: true,
    default: ({ haveSentMoneyToUser }: { haveSentMoneyToUser?: boolean }) => (
        <div data-testid="profile-header" data-sent-money={String(!!haveSentMoneyToUser)} />
    ),
}))
jest.mock('@/components/Badges/BadgesRow', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Home/HomeHistory', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev?: () => void }) =>
        onPrev ? <button data-testid="nav-back" onClick={onPrev} /> : null,
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    // Renders description + content when visible so the guest Request-gate
    // modal (the second crediting door) is assertable.
    default: ({ visible, description, content }: { visible?: boolean; description?: string; content?: ReactNode }) =>
        visible ? (
            <div data-testid="action-modal">
                <p>{description}</p>
                {content}
            </div>
        ) : null,
}))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: ComponentProps<'button'>) => <button onClick={onClick}>{children}</button>,
}))

const JOIN_CTA = en.profile.publicProfile.joinCta

type ValidateResult = {
    success: boolean
    attributionResolved: boolean
    onboardingResolved: boolean
    username: string
}

const unresolvable: ValidateResult = {
    success: true,
    attributionResolved: false,
    onboardingResolved: false,
    username: '',
}
const resolvesToMaria: ValidateResult = {
    success: true,
    attributionResolved: true,
    onboardingResolved: true,
    username: 'maria',
}

// A validation the test settles by hand, so the ordering between the store
// handoff and the awaited response is assertable.
const deferValidation = () => {
    let settle: (result: ValidateResult) => void = () => {}
    const promise = new Promise<ValidateResult>((resolve) => {
        settle = resolve
    })
    mockValidateInviteCode.mockReturnValue(promise)
    return settle
}

beforeEach(() => {
    jest.clearAllMocks()
    safeBackTesting.reset()
    mockAuth = { user: null, isFetchingUser: false }
    mockInterceptGuestCta.mockReturnValue(false)
    mockGetByUsername.mockResolvedValue(null)
    mockUseUserInteractions.mockReturnValue({ interactions: {}, isLoading: false, isError: false })
    // the door validates before persisting; default = resolvable inviter
    mockValidateInviteCode.mockResolvedValue({
        success: true,
        attributionResolved: true,
        onboardingResolved: true,
        username: 'satoshi',
    })
})

describe('PublicProfile guest door', () => {
    it('credits the profile owner and routes the guest into /invite', async () => {
        renderWithIntl(<PublicProfile username="Satoshi" />)

        expect(
            await screen.findByText(en.profile.publicProfile.invitedLine.replace('{username}', 'Satoshi'))
        ).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: JOIN_CTA }))

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/invite?code=satoshi'))
        expect(mockValidateInviteCode).toHaveBeenCalledWith('satoshi')
        expect(mockStashInvite).toHaveBeenCalledWith('satoshi', 'DIRECT')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
    })

    it('hands off to the store inside the click, and still writes the cookie after', async () => {
        mockInterceptGuestCta.mockReturnValue(true)
        const settleValidation = deferValidation()
        renderWithIntl(<PublicProfile username="Satoshi" />)

        fireEvent.click(await screen.findByRole('button', { name: JOIN_CTA }))

        // gesture-first: the handoff calls window.open, which iOS blocks once it
        // runs in a promise continuation — so it must fire before the validation
        // response lands, not after it
        expect(mockInterceptGuestCta).toHaveBeenCalled()
        expect(mockStashInvite).not.toHaveBeenCalled()

        settleValidation({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'satoshi',
        })

        // the handoff opens `_blank`, so this tab lives on and the cookie lands
        await waitFor(() => expect(mockStashInvite).toHaveBeenCalledWith('satoshi', 'DIRECT'))
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows no join cta to a logged-in visitor', async () => {
        mockAuth = { user: { user: { username: 'hal', hasAppAccess: true } }, isFetchingUser: false }
        renderWithIntl(<PublicProfile username="satoshi" isLoggedIn />)

        expect(await screen.findByRole('button', { name: en.navigation.send })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: JOIN_CTA })).not.toBeInTheDocument()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, expect.anything())
    })

    it('holds the impression back until auth has settled', async () => {
        mockAuth = { user: null, isFetchingUser: true }
        renderWithIntl(<PublicProfile username="satoshi" />)

        await screen.findByRole('button', { name: JOIN_CTA })
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, expect.anything())
    })

    it('fires the referral impression once auth has settled on a guest', async () => {
        renderWithIntl(<PublicProfile username="satoshi" />)

        await screen.findByRole('button', { name: JOIN_CTA })
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
    })

    it('routes a guest through the crediting door from the Request-gate modal too', async () => {
        renderWithIntl(<PublicProfile username="Satoshi" />)

        // Request opens the invite-gate modal for guests — it must offer the
        // same crediting door as the join card, not the old beg-for-an-invite
        // dead end.
        fireEvent.click(await screen.findByRole('button', { name: en.navigation.request }))
        const modal = await screen.findByTestId('action-modal')
        expect(modal).toHaveTextContent(en.profile.publicProfile.invitedLine.replace('{username}', 'Satoshi'))

        const joinButtons = screen.getAllByRole('button', { name: JOIN_CTA })
        fireEvent.click(joinButtons[joinButtons.length - 1])

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/invite?code=satoshi'))
        expect(mockStashInvite).toHaveBeenCalledWith('satoshi', 'DIRECT')
    })

    // Three ways a code fails to credit. All three still navigate — /invite owns
    // the messaging — but a poisoned cookie outlives this page (PR #2346 shape),
    // so none of them may write one. `null` = the validation call itself fails.
    test.each([
        ['the backend cannot resolve it', 'Satoshi', 'satoshi', unresolvable],
        // the API's typo-fallback resolves a waitlisted `maria23` to real user `maria`
        ['it resolves to somebody other than the profile owner', 'Maria23', 'maria23', resolvesToMaria],
        ['the validation call itself fails', 'Satoshi', 'satoshi', null],
    ] as Array<[string, string, string, ValidateResult | null]>)(
        'navigates without a cookie when %s',
        async (_label, profileUsername, expectedCode, validation) => {
            if (validation) mockValidateInviteCode.mockResolvedValue(validation)
            else mockValidateInviteCode.mockRejectedValue(new Error('network down'))
            renderWithIntl(<PublicProfile username={profileUsername} />)

            fireEvent.click(await screen.findByRole('button', { name: JOIN_CTA }))

            await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/invite?code=${expectedCode}`))
            expect(mockStashInvite).not.toHaveBeenCalled()
            expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
                link_type: 'none',
            })
        }
    )
})

// The "sent money before" badge comes from the interaction-status endpoint (the
// complete source — send-link claims included), never from the profile payload's
// narrow received-from-you sum (TASK-21929).
describe('PublicProfile prior-transfer indicator', () => {
    beforeEach(() => {
        mockAuth = { user: { user: { username: 'hal', hasAppAccess: true } }, isFetchingUser: false }
        mockGetByUsername.mockResolvedValue({ userId: 'user-1' })
    })

    it('shows the indicator when interaction status reports a prior transfer', async () => {
        mockUseUserInteractions.mockReturnValue({
            interactions: { 'user-1': true },
            isLoading: false,
            isError: false,
        })
        renderWithIntl(<PublicProfile username="satoshi" isLoggedIn />)

        await waitFor(() => expect(screen.getByTestId('profile-header')).toHaveAttribute('data-sent-money', 'true'))
        expect(mockUseUserInteractions).toHaveBeenLastCalledWith(['user-1'])
    })

    it('stays neutral while the interaction query is loading', async () => {
        mockUseUserInteractions.mockReturnValue({ interactions: {}, isLoading: true, isError: false })
        renderWithIntl(<PublicProfile username="satoshi" isLoggedIn />)

        await waitFor(() => expect(mockUseUserInteractions).toHaveBeenLastCalledWith(['user-1']))
        expect(screen.getByTestId('profile-header')).toHaveAttribute('data-sent-money', 'false')
    })

    it('never queries interaction status for guests', async () => {
        mockAuth = { user: null, isFetchingUser: false }
        renderWithIntl(<PublicProfile username="satoshi" />)

        await screen.findByRole('button', { name: JOIN_CTA })
        expect(mockUseUserInteractions).toHaveBeenLastCalledWith([])
    })
})

describe('PublicProfile back navigation', () => {
    beforeEach(() => {
        mockAuth = { user: { user: { username: 'hal', hasAppAccess: true } }, isFetchingUser: false }
    })

    it('falls back to /home on a cold deep-link (no in-app history)', async () => {
        renderWithIntl(<PublicProfile username="satoshi" isLoggedIn />)

        fireEvent.click(await screen.findByTestId('nav-back'))
        expect(mockPush).toHaveBeenCalledWith('/home')
        expect(mockBack).not.toHaveBeenCalled()
    })

    it('returns through in-app history when it exists (Rewards → profile → back)', async () => {
        window.history.pushState({}, '', '/satoshi')
        renderWithIntl(<PublicProfile username="satoshi" isLoggedIn />)

        fireEvent.click(await screen.findByTestId('nav-back'))
        expect(mockBack).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })
})
