import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import InvitesPage from './InvitesPage'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockDispatch = jest.fn()
const mockFetchUser = jest.fn().mockResolvedValue(null)
const mockLogin = jest.fn().mockResolvedValue(undefined)
const mockClaimBadgeCampaigns = jest.fn()
const mockQueuePendingBadgeCampaigns = jest.fn((badgeCampaigns: readonly string[], _days?: number) => [
    ...badgeCampaigns,
])
const mockSaveToCookie = jest.fn()
const mockSaveRedirectUrl = jest.fn()
const mockInterceptGuestCta = jest.fn(() => false)
const mockUseGuestStoreHandoff = jest.fn()

let mockSearch = ''
let mockAuth: {
    user: null | { user: { userId: string; username: string; hasAppAccess: boolean } }
    isFetchingUser: boolean
    fetchUser: jest.Mock
}
let mockQueryResult: {
    data?: {
        success: boolean
        attributionResolved: boolean
        onboardingResolved: boolean
        username: string
        legacyAcquisition?: {
            campaignTag: string
            fallback: 'normal_app'
            destination: 'offramp_migration' | 'normal_app'
        }
    }
    isLoading: boolean
    isError: boolean
}

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    useSearchParams: () => new URLSearchParams(mockSearch),
}))

jest.mock('@tanstack/react-query', () => ({ useQuery: () => mockQueryResult }))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/redux/hooks', () => ({ useAppDispatch: () => mockDispatch }))
const mockStashInvite = jest.fn()
jest.mock('@/utils/invite-stash', () => ({
    stashInvite: (...args: unknown[]) => mockStashInvite(...args),
    readInviteCode: () => '',
    readInviteType: () => 'DIRECT',
    clearInvite: jest.fn(),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    ...jest.requireActual('@/components/0_Bruddle/Toast'),
    useToast: () => ({ error: jest.fn(), success: jest.fn() }),
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: (opts: { trackImpressionWhenGuest?: boolean }) => {
        mockUseGuestStoreHandoff(opts)
        return { interceptGuestCta: mockInterceptGuestCta, storeHandoffModal: null }
    },
}))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: (badgeCampaigns: readonly string[]) => mockClaimBadgeCampaigns(badgeCampaigns),
    // every destination maps to /home since the offramp migration surface
    // was removed (TASK-20535); mirror the real service
    destinationForConfirmedBadgeCampaignAcquisition: () => '/home',
    isConfirmedBadgeCampaignClaim: (claim: { outcome: string }) =>
        claim.outcome === 'awarded' || claim.outcome === 'already_owned',
    isUnavailableBadgeCampaignClaim: (claim: { outcome: string }) =>
        claim.outcome === 'inactive' || claim.outcome === 'expired' || claim.outcome === 'unknown',
}))
jest.mock('./badge-campaign-context', () => {
    const actual = jest.requireActual('./badge-campaign-context')
    return {
        ...actual,
        queuePendingBadgeCampaigns: (badgeCampaigns: readonly string[], days?: number) =>
            days === undefined
                ? mockQueuePendingBadgeCampaigns(badgeCampaigns)
                : mockQueuePendingBadgeCampaigns(badgeCampaigns, days),
    }
})
jest.mock('@/utils/general.utils', () => ({
    saveToCookie: (...args: unknown[]) => mockSaveToCookie(...args),
    saveRedirectUrl: () => mockSaveRedirectUrl(),
    getValidRedirectUrl: (redirectUrl: string, fallback: string) => {
        try {
            const decoded = decodeURIComponent(redirectUrl)
            const url = new URL(decoded, window.location.origin)
            return url.origin === window.location.origin ? url.pathname + url.search + url.hash : fallback
        } catch {
            return fallback
        }
    },
}))
jest.mock('@/utils/native-routes', () => ({ profileUrl: (username: string) => `/profile/${username}` }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/assets/mascot', () => ({ PeanutWavingHello: { src: '/peanut.svg' } }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <button onClick={onClick}>{children}</button>
    ),
}))
jest.mock('./InvitesPageLayout', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('../Global/Loading', () => ({
    __esModule: true,
    default: (props: any) => (props.variant === 'mascot' ? <div>Loading</div> : <div data-testid="loading-spinner" />),
}))
jest.mock('../Payment/Views/Error.validation.view', () => ({
    __esModule: true,
    default: ({ title, message }: { title: string; message: string }) => (
        <div>
            <h1>{title}</h1>
            <p>{message}</p>
        </div>
    ),
}))
jest.mock('../Global/UnsupportedBrowserModal', () => ({
    __esModule: true,
    default: () => null,
}))

const awardedBatch = {
    transport: 'canonical',
    pending: [],
    claims: [{ badgeCampaign: 'nita', badgeCode: 'NITA', outcome: 'awarded' }],
}

describe('invite and badge campaign routing boundaries', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockSearch = ''
        mockAuth = {
            user: { user: { userId: 'user-1', username: 'member', hasAppAccess: true } },
            isFetchingUser: false,
            fetchUser: mockFetchUser,
        }
        mockQueryResult = { isLoading: false, isError: false }
        mockInterceptGuestCta.mockReturnValue(false)
        mockClaimBadgeCampaigns.mockResolvedValue(awardedBatch)
        mockQueuePendingBadgeCampaigns.mockImplementation((badgeCampaigns: readonly string[]) => [...badgeCampaigns])
    })

    it('never derives NITA acquisition from the Juana inviter code alone', async () => {
        mockSearch = 'code=juanacervio'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'juanacervio',
        }

        render(<InvitesPage />)

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/juanacervio'))
        expect(mockClaimBadgeCampaigns).not.toHaveBeenCalled()
    })

    it('uses backend validation metadata for an authenticated code-only Offramp journey', async () => {
        mockSearch = 'code=offramp'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        }
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [
                {
                    badgeCampaign: 'offramp',
                    badgeCode: 'OFFRAMP_USER',
                    outcome: 'already_owned',
                },
            ],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith(['offramp']))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
    })

    it('falls back to the normal app when code-only legacy acquisition is unconfirmed', async () => {
        mockSearch = 'code=offramp'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        }
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: ['offramp'],
            claims: [{ badgeCampaign: 'offramp', outcome: 'retryable_error' }],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
    })

    it.each([
        ['token-nation-2026', 'TOKEN_NATION_SP_2026'],
        ['nita', 'NITA'],
    ])('source-qualifies historic UTM alias %s and follows only the typed backend outcome', async (raw, badgeCode) => {
        mockSearch = `utm_campaign=${raw}`
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [
                {
                    badgeCampaign: `utm:${raw}`,
                    badgeCode,
                    outcome: 'awarded',
                },
            ],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith([`utm:${raw}`]))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
    })

    it.each([
        ['campaign=naija', 'naija', 'NAIJA'],
        ['badge_campaign=naija', 'naija', 'NAIJA'],
        ['campaign=terere', 'terere', 'TERERE'],
        ['badge_campaign=terere', 'terere', 'TERERE'],
    ])('keeps the bare campaign URL %s claimable without an inviter', async (search, badgeCampaign, badgeCode) => {
        mockSearch = search
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [{ badgeCampaign, badgeCode, outcome: 'awarded' }],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith([badgeCampaign]))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
        expect(screen.queryByText('Invalid Invite Code')).not.toBeInTheDocument()
    })

    it.each([
        ['badge_campaign=offramp', 'offramp'],
        ['campaign=offramp', 'offramp'],
        ['utm_campaign=offramp', 'utm:offramp'],
    ])('uses confirmed acquisition navigation for badge-campaign-only %s', async (search, badgeCampaign) => {
        mockSearch = search
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [
                {
                    badgeCampaign,
                    badgeCode: 'OFFRAMP_USER',
                    outcome: 'awarded',
                    capabilities: [{ key: 'app.offramp_migration_entry' }],
                    acquisition: {
                        fallback: 'normal_app',
                        destination: 'offramp_migration',
                    },
                },
            ],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith([badgeCampaign]))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
    })

    it.each([
        ['badge_campaign=offramp', 'offramp'],
        ['campaign=offramp', 'offramp'],
        ['utm_campaign=offramp', 'utm:offramp'],
        ['campaign=naija', 'naija'],
        ['campaign=terere', 'terere'],
    ])('queues signed-out %s for post-registration badge settlement', async (search, badgeCampaign) => {
        mockAuth.user = null
        mockSearch = search

        render(<InvitesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Sign up' }))

        expect(mockQueuePendingBadgeCampaigns).toHaveBeenCalledWith([badgeCampaign])
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup')
    })

    it('processes campaign independently when the inviter code is invalid', async () => {
        mockSearch = 'code=bad&badge_campaign=nita'
        mockQueryResult.data = {
            success: false,
            attributionResolved: false,
            onboardingResolved: false,
            username: '',
        }
        mockQueryResult.isError = true

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith(['nita']))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
        expect(screen.queryByText('Invalid Invite Code')).not.toBeInTheDocument()
    })

    it('processes code plus campaign while preserving the normal inviter destination', async () => {
        mockSearch = 'code=alice&badge_campaign=nita'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'alice',
        }

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith(['nita']))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/alice'))
    })

    // no campaign carries a bespoke destination anymore (offramp migration
    // surface removed), so the inviter profile keeps navigation
    it('keeps the personal inviter profile when a confirmed claim resolves the default destination', async () => {
        mockSearch = 'code=alice&badge_campaign=offramp'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'alice',
        }
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [
                {
                    badgeCampaign: 'offramp',
                    outcome: 'awarded',
                    acquisition: {
                        fallback: 'normal_app',
                        destination: 'offramp_migration',
                    },
                },
            ],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/alice'))
    })

    it('preserves a safe financial continuation over campaign and inviter navigation', async () => {
        mockSearch =
            'code=alice&badge_campaign=nita&redirect_uri=%2Fclaim%3Fstep%3Dclaim%26link%3Dhttps%253A%252F%252Fpeanut.to%252Fclaim'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'alice',
        }

        render(<InvitesPage />)

        await waitFor(() => expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith(['nita']))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/claim?step=claim&link=https://peanut.to/claim'))
        expect(mockPush).not.toHaveBeenCalledWith('/profile/alice')
    })

    it('preserves a safe caller continuation while a published compatibility badge settles', async () => {
        mockSearch = 'code=offramp&redirect_uri=%2Fclaim%3Fstep%3Dclaim%26id%3Dpayment-1'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        }
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [{ badgeCampaign: 'offramp', outcome: 'already_owned' }],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/claim?step=claim&id=payment-1'))
        // exactly one navigation: campaign and inviter destinations must not fire
        expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('shows Invalid Invite only for an invalid code with no independent campaign', async () => {
        mockSearch = 'code=bad'
        mockQueryResult.data = {
            success: false,
            attributionResolved: false,
            onboardingResolved: false,
            username: '',
        }
        mockQueryResult.isError = true

        render(<InvitesPage />)

        expect(await screen.findByText('Invalid Invite Code')).toBeInTheDocument()
        expect(mockClaimBadgeCampaigns).not.toHaveBeenCalled()
    })

    it('falls through to the normal app for a terminal unavailable campaign', async () => {
        mockSearch = 'badge_campaign=retired'
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [{ badgeCampaign: 'retired', outcome: 'expired' }],
        })

        render(<InvitesPage />)

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
        expect(screen.queryByText(/badge unlocked/i)).not.toBeInTheDocument()
    })

    it('stores valid inviter attribution and campaign identity separately for signup', async () => {
        mockAuth.user = null
        mockSearch = 'code=alice&utm_campaign=summer-analytics&badge_campaign=Creator%2FSummer&badge_campaign=second'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'alice',
        }

        render(<InvitesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Claim your spot' }))

        expect(mockStashInvite).toHaveBeenCalledWith('alice', 'PAYMENT_LINK')
        expect(mockQueuePendingBadgeCampaigns).toHaveBeenCalledWith(['Creator/Summer', 'second'])
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup')
    })

    it('leaves code-only compatibility acquisition to signed-out invite acceptance', async () => {
        mockAuth.user = null
        mockSearch = 'code=offramp'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        }

        render(<InvitesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Claim your spot' }))

        expect(mockStashInvite).toHaveBeenCalledWith('offramp', 'PAYMENT_LINK')
        expect(mockQueuePendingBadgeCampaigns).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup')
    })

    it('uses onboardingResolved rather than a username-shaped field for a NONE adapter', async () => {
        mockAuth.user = null
        mockSearch = 'code=founderhaus'
        mockQueryResult.data = {
            success: true,
            attributionResolved: false,
            onboardingResolved: false,
            username: 'legacy-placeholder',
            legacyAcquisition: {
                campaignTag: 'founderhaus',
                fallback: 'normal_app',
                destination: 'normal_app',
            },
        }

        render(<InvitesPage />)

        expect(await screen.findByText('Claim your badge')).toBeInTheDocument()
        expect(screen.queryByText(/legacy-placeholder invited you/i)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(mockStashInvite).toHaveBeenCalledWith('founderhaus', 'PAYMENT_LINK')
        expect(mockQueuePendingBadgeCampaigns).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup')
    })

    it('keeps a validated system inviter distinct from its generic analytics UTM during signup', async () => {
        mockAuth.user = null
        mockSearch = 'code=SQUIRRELINVITESYOU&utm_campaign=summer-analytics'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'arbiverseinvitesyou',
                fallback: 'normal_app',
                destination: 'normal_app',
            },
        }

        render(<InvitesPage />)

        expect(await screen.findByText('peanut invited you to Peanut')).toBeInTheDocument()
        expect(screen.queryByText('Claim your badge')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Claim your spot' }))

        expect(mockStashInvite).toHaveBeenCalledWith('squirrelinvitesyou', 'PAYMENT_LINK')
        expect(mockQueuePendingBadgeCampaigns).toHaveBeenCalledWith(['utm:summer-analytics'])
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup')
    })

    it('consumes unknown analytics without blocking a typed system acquisition normal fallback', async () => {
        mockSearch = 'code=SQUIRRELINVITESYOU&utm_campaign=summer-analytics'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'arbiverseinvitesyou',
                fallback: 'normal_app',
                destination: 'normal_app',
            },
        }
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [
                { badgeCampaign: 'utm:summer-analytics', outcome: 'unknown' },
                { badgeCampaign: 'arbiverseinvitesyou', outcome: 'already_owned' },
            ],
        })

        render(<InvitesPage />)

        await waitFor(() =>
            expect(mockClaimBadgeCampaigns).toHaveBeenCalledWith(['utm:summer-analytics', 'arbiverseinvitesyou'])
        )
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
        expect(mockPush).not.toHaveBeenCalledWith('/profile/peanut')
    })

    it('names the campaign and the reason in the unavailable warning, as a string', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockSearch = 'badge_campaign=utm:pix,retired'
        mockQueryResult.data = { success: true, attributionResolved: true, onboardingResolved: true, username: '' }
        mockClaimBadgeCampaigns.mockResolvedValue({
            transport: 'canonical',
            pending: [],
            claims: [
                { badgeCampaign: 'utm:pix', outcome: 'unknown' },
                { badgeCampaign: 'retired', outcome: 'expired' },
            ],
        })

        render(<InvitesPage />)

        await waitFor(() =>
            expect(warn).toHaveBeenCalledWith(
                'Badge campaign unavailable; continuing normally',
                'utm:pix=unknown, retired=expired'
            )
        )

        // The regression this pins. Sentry serializes each console argument, so the
        // previous object payload reached production as the literal "[object Object]"
        // and the warning named neither the campaign nor the reason (PEANUT-UI-SJC).
        const call = warn.mock.calls.find(([message]) => message === 'Badge campaign unavailable; continuing normally')
        expect(typeof call?.[1]).toBe('string')

        // The message must stay constant, or Sentry opens a new issue per campaign.
        expect(call?.[0]).toBe('Badge campaign unavailable; continuing normally')

        warn.mockRestore()
    })

    it('returns existing-user login to code-only badge acquisition before normal fallback', async () => {
        mockAuth.user = null
        mockSearch = 'code=offramp'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        }

        render(<InvitesPage />)
        fireEvent.click(await screen.findByRole('button', { name: /already have an account/i }))

        expect(mockQueuePendingBadgeCampaigns).toHaveBeenCalledWith(['offramp'], 30)
        expect(mockSaveRedirectUrl).toHaveBeenCalledTimes(1)
        expect(mockLogin).toHaveBeenCalledTimes(1)
    })

    it('hands a guest Claim your spot off to the stores during the migration window', async () => {
        mockAuth.user = null
        mockSearch = 'code=alice'
        mockQueryResult.data = {
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            username: 'alice',
        }
        mockInterceptGuestCta.mockReturnValue(true)

        render(<InvitesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Claim your spot' }))

        // invite bookkeeping still runs so post-install signup recovers context
        expect(mockStashInvite).toHaveBeenCalledWith('alice', 'PAYMENT_LINK')
        expect(mockInterceptGuestCta).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalledWith('/setup?step=signup')
        // the CTA rendered for a settled guest — the impression must be armed
        const lastOpts = mockUseGuestStoreHandoff.mock.calls.at(-1)?.[0]
        expect(lastOpts?.trackImpressionWhenGuest).toBe(true)
    })

    it('never arms the guest impression on the invalid-invite error view', async () => {
        mockAuth.user = null
        mockSearch = 'code=bad'
        mockQueryResult.data = {
            success: false,
            attributionResolved: false,
            onboardingResolved: false,
            username: '',
        }
        mockQueryResult.isError = true

        render(<InvitesPage />)
        expect(await screen.findByText('Invalid Invite Code')).toBeInTheDocument()

        // no CTA on this view → counting it would skew the TASK-20939 funnel
        for (const [opts] of mockUseGuestStoreHandoff.mock.calls) {
            expect(opts?.trackImpressionWhenGuest).toBe(false)
        }
    })

    it('does not persist a bad inviter alongside a valid campaign', async () => {
        mockAuth.user = null
        mockSearch = 'code=bad&utm_campaign=analytics&campaign=legacy&badge_campaign=nita'
        mockQueryResult.data = {
            success: false,
            attributionResolved: false,
            onboardingResolved: false,
            username: '',
        }

        render(<InvitesPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Sign up' }))

        expect(mockSaveToCookie).not.toHaveBeenCalled()
        expect(mockDispatch).not.toHaveBeenCalled()
        expect(mockQueuePendingBadgeCampaigns).toHaveBeenCalledWith(['nita'])
        expect(mockPush).toHaveBeenCalledWith('/setup?step=signup')
    })
})
