/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi } from '@/services/rain'
import { useCardFlow } from '../useCardFlow'

const mockCapture = jest.fn()
let mockFunded = true
let mockBalance: bigint | undefined = 10_000_000n
let mockState = 'add-card'
let mockOverview: Record<string, unknown> | undefined
let mockOverviewLoading = false
let mockUser: { user: { userId: string } } | null = { user: { userId: 'user-1' } }
let mockRainRails: Array<{ id: string; reason?: { code: string; userMessage: string } }> = []
const mockInvalidateQueries = jest.fn()
let mockUserFetching = 0
const mockQueryClient = {
    invalidateQueries: mockInvalidateQueries,
    isFetching: () => mockUserFetching,
    setQueryData: jest.fn(),
}

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    notFound: jest.fn(),
    useRouter: () => ({ push: mockRouterPush }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
    useQueryClient: () => mockQueryClient,
    useIsFetching: () => mockUserFetching,
}))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
jest.mock('@/services/card', () => ({
    cardApi: { getInfo: jest.fn() },
}))
jest.mock('@/services/rain', () => ({
    rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn(), getFundingAccess: jest.fn() },
}))
// The existing card permission is signed by its own (tested) hook; here only
// whether and when the flow asks for it matters.
const mockSerializeGrant = jest.fn()
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ serializeGrant: mockSerializeGrant }),
}))
jest.mock('@/services/consent', () => ({
    cardConsentDocuments: jest.fn(() => []),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
    useRainCardOverview: () => ({ overview: mockOverview, isLoading: mockOverviewLoading, error: null }),
}))
jest.mock('@/components/Card/cardState.utils', () => ({
    computeCardState: () => (mockOverviewLoading ? 'loading' : mockState),
}))
jest.mock('@/components/Card/cardApply.utils', () => ({
    pollUntilApplyAdvances: jest.fn(),
    pollUntilReady: jest.fn(),
}))
jest.mock('@/app/actions/sumsub', () => ({
    initiateSelfHealResubmission: jest.fn(),
}))
const mockGrantFunding = jest.fn()
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: () => ({ grant: mockGrantFunding }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: mockBalance, hasSufficientSpendableBalance: () => mockFunded }),
}))
// The connected wallet: a flow belongs to one user and one wallet.
let mockAddress: string | undefined = '0xA'
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ address: mockAddress }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        railsForProvider: (provider: string) => (provider === 'rain' ? mockRainRails : []),
        nextActionsForRail: () => [],
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useHostedVerification', () => ({
    useHostedVerification: () => ({ start: jest.fn(), error: null }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))
jest.mock('@/hooks/useSumsubReloadResume', () => ({
    useSumsubReloadResume: jest.fn(),
}))
const mockStartAction = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleStartAction: mockStartAction }),
}))

const mockApplyForCard = rainApi.applyForCard as jest.Mock
const mockGetFundingAccess = rainApi.getFundingAccess as jest.Mock

beforeEach(() => {
    mockAddress = '0xA'
})

describe('useCardFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // the existing cases accept the managed terms on a managed account
        mockGetFundingAccess.mockResolvedValue({ fundingMode: 'managed', enrollmentAllowed: true })
        mockUserFetching = 0
        mockFunded = true
        mockState = 'add-card'
        mockOverview = undefined
        mockOverviewLoading = false
        mockUser = { user: { userId: 'user-1' } }
        mockRainRails = []
        window.localStorage.clear()
    })

    // the API refuses a legacy applicant to a Smart Paperwork Verification user
    it('an application the API sends to /verify goes there, never to an error or the legacy check', async () => {
        const { ApiError } = jest.requireActual('@/services/api-error')
        mockOverview = { status: { hasApplication: false }, cards: [] }
        mockApplyForCard.mockRejectedValue(
            new ApiError('Answer a few questions to start your verification.', {
                status: 409,
                code: 'paperwork_verification_required',
            })
        )
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(mockRouterPush).toHaveBeenCalledWith('/verify')
        expect(result.current.applyError).toBeNull()
    })

    it('does not contact Rain before a confirmed $10 balance for a new application', async () => {
        mockFunded = false
        mockOverview = { status: { hasApplication: false }, cards: [] }
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(mockApplyForCard).not.toHaveBeenCalled()
        expect(result.current.needsFundingBeforeApply).toBe(true)
        expect(result.current.fundingRequired).toBe(true)
    })

    it('rechecks funding if the balance drops after the terms screen opens', async () => {
        mockOverview = { status: { hasApplication: false }, cards: [] }
        mockApplyForCard.mockResolvedValue({ status: 'terms-required', isUsResident: false })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        mockApplyForCard.mockClear()
        mockFunded = false
        rerender()
        await act(async () => {
            await result.current.handleAcceptTerms({
                authorizationAccepted: true,
                authorizationText: 'I authorize transfers according to the Real-Time Funding Terms.',
            })
        })
        expect(mockApplyForCard).not.toHaveBeenCalled()
        expect(mockGrantFunding).not.toHaveBeenCalled()
        expect(result.current.pendingTerms).toBeNull()
        expect(result.current.fundingRequired).toBe(true)
    })

    it('keeps an existing application recovery accessible without the new minimum', async () => {
        mockFunded = false
        mockOverview = { status: { hasApplication: true, railStatus: 'PENDING' }, cards: [] }
        mockApplyForCard.mockResolvedValue({ status: 'pending' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(mockApplyForCard).toHaveBeenCalledTimes(1)
        expect(result.current.needsFundingBeforeApply).toBe(false)
        expect(result.current.fundingRequired).toBe(false)
    })

    it('opens the sumsub sdk on an incomplete apply response', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 'tok-1' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.sumsubToken).toBe('tok-1')
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
    })

    it('asks the Smart Paperwork Verification card questions on questions-required, then applies again once they are saved', async () => {
        mockApplyForCard.mockResolvedValueOnce({ status: 'questions-required', step: 'purpose' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.pendingQuestions).toBe('purpose')
        expect(result.current.pendingTerms).toBeNull()

        mockApplyForCard.mockResolvedValueOnce({ status: 'terms-required', isUsResident: true })
        await act(async () => {
            result.current.handleQuestionsDone()
        })
        expect(mockApplyForCard).toHaveBeenCalledTimes(2)
        expect(mockApplyForCard).toHaveBeenLastCalledWith(expect.objectContaining({ termsAccepted: false }))
        expect(result.current.pendingQuestions).toBeNull()
        expect(result.current.pendingTerms).toEqual({ isUsResident: true })
    })

    it('asks the job again when Rain refused the title (questions-required at the work step)', async () => {
        mockApplyForCard.mockResolvedValueOnce({ status: 'questions-required', step: 'work' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.pendingQuestions).toBe('work')
    })

    it('routes terms-required to the terms screen', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'terms-required', isUsResident: true })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.pendingTerms).toEqual({ isUsResident: true })
        expect(result.current.pendingCountryConfirmation).toBeNull()
    })

    it('routes country-confirmation-required before terms', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'country-confirmation-required', candidates: ['AR', 'BR'] })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.pendingCountryConfirmation).toEqual({ candidates: ['AR', 'BR'] })
        expect(result.current.pendingTerms).toBeNull()
    })

    it('routes a pending-residence block to its recoverable screen instead of the terminal geo block', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'pending-residence-blocked', message: 'review residence' })
        const { result } = renderHook(() => useCardFlow())

        await act(async () => {
            await result.current.handleApply()
        })

        expect(result.current.pendingResidenceBlocked).toBe(true)
        expect(result.current.geoBlocked).toBe(false)
    })

    describe('a card the plan does not send to Rain', () => {
        const refused = (reason?: string) => ({
            status: 'provider-not-in-plan',
            ...(reason ? { reason } : {}),
            message: 'The card is not part of your current verification.',
        })

        it('opens the missing requirement through start-action', async () => {
            mockApplyForCard.mockResolvedValue(refused('requirements_missing'))
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleApply()
            })
            expect(mockStartAction).toHaveBeenCalledWith('supplement:rain')
            expect(result.current.planRefusal).toBeNull()
            expect(result.current.applyError).toBeNull()
        })

        it.each(['identity_document_insufficient', 'requirements_uncollectable'])(
            'holds %s for the status screen instead of an English error',
            async (reason) => {
                mockApplyForCard.mockResolvedValue(refused(reason))
                const { result } = renderHook(() => useCardFlow())
                await act(async () => {
                    await result.current.handleApply()
                })
                expect(result.current.planRefusal).toBe(reason)
                expect(result.current.applyError).toBeNull()
                expect(mockStartAction).not.toHaveBeenCalled()
            }
        )

        it('keeps the error line for a refusal the app has no copy for', async () => {
            mockApplyForCard.mockResolvedValue(refused('not_requested'))
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleApply()
            })
            expect(result.current.planRefusal).toBeNull()
            expect(result.current.applyError).toBe('The card is not part of your current verification.')
        })
    })

    it('surfaces an apply failure as applyError', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        mockApplyForCard.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.applyError).toBe('boom')
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: 'boom' })
        consoleSpy.mockRestore()
    })

    it('surfaces a retryable error when a pending apply lands back on the entry screen', async () => {
        // BE answers 'pending' even when the inline card-create failed (e.g.
        // Rain 400 on virtualCardArt) — the rail lands ENABLED with no card
        // and the state machine routes back to add-card. That must not be
        // silent: the entry screen shows the retryable notification.
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        expect(result.current.applyError).toBeNull()
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBe('page.issueFailed')
    })

    it('stays armed through pending review and still catches a later failed issuance', async () => {
        // async approval path: apply lands on the pending screen first. If
        // Rain approves later and auto-issuance fails, the overview moves to
        // ENABLED with no card — the detector must not have disarmed on the
        // intermediate pending state (chip review finding on 28c2a767).
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        mockState = 'pending'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'PENDING' } }
        rerender()
        expect(result.current.applyError).toBeNull()
        mockState = 'add-card'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBe('page.issueFailed')
    })

    it('disarms silently once a card exists', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        mockState = 'active'
        mockOverview = { cards: [{ status: 'ACTIVE' }], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        // detector disarmed — a later unrelated add-card render must not error
        mockState = 'add-card'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBeNull()
    })

    it('stays silent when a pending apply advances to a non-entry screen', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        mockState = 'pending'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'PENDING' } }
        rerender()
        expect(result.current.applyError).toBeNull()
    })

    describe('handleAcceptTerms — the funding permission follows the application', () => {
        const CONSENT = {
            authorizationAccepted: true,
            authorizationText: 'I authorize transfers according to the Real-Time Funding Terms.',
        }

        it('applies first, then grants with the boxes the person ticked — and sends no serializedApproval', async () => {
            const order: string[] = []
            mockGrantFunding.mockImplementation(async () => {
                order.push('grant')
                return { ok: true, status: 'pending' }
            })
            mockApplyForCard.mockImplementation(async () => {
                order.push('apply')
                return { status: 'pending', rainUserId: 'ru-1', message: 'submitted' }
            })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(order).toEqual(['apply', 'grant'])
            // handed over for exactly the user and wallet that accepted
            expect(mockGrantFunding).toHaveBeenCalledWith(CONSENT, { userId: 'user-1', connectedAddress: '0xA' })
            expect(mockApplyForCard).toHaveBeenCalledWith({ termsAccepted: true, acceptedDocuments: [] })
            expect(result.current.isIssuing).toBe(false)
        })

        it('a cancelled or failed grant leaves the issued card and shows no card error', async () => {
            mockGrantFunding.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })
            mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            // the Home prompt asks again; the application itself is not undone
            expect(result.current.applyError).toBeNull()
            expect(result.current.isIssuing).toBe(false)
        })

        it.each([
            [{ status: 'terms-required', isUsResident: false }],
            [{ status: 'incomplete', sumsubAccessToken: 'tok-1' }],
            [{ status: 'geo-blocked', message: 'no' }],
        ])('never signs the permission when the application did not go through (%j)', async (response) => {
            mockApplyForCard.mockResolvedValue(response)
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockGrantFunding).not.toHaveBeenCalled()
        })

        it('never signs the permission when the application call fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
            mockApplyForCard.mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockGrantFunding).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe('boom')
            consoleSpy.mockRestore()
        })

        it('a managed account finishes on the managed path even when new enrollment is closed', async () => {
            mockGetFundingAccess.mockResolvedValue({ fundingMode: 'managed', enrollmentAllowed: false })
            mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockApplyForCard).toHaveBeenCalledTimes(1)
            expect(mockGrantFunding).toHaveBeenCalledWith(CONSENT, { userId: 'user-1', connectedAddress: '0xA' })
            expect(mockSerializeGrant).not.toHaveBeenCalled()
        })

        // Account A's application answers after the person switched to B (or
        // to another wallet). A's consent must never start B's enrollment or
        // any signature, and A's answer changes nothing on B's screen.
        it.each([
            ['another account', () => (mockUser = { user: { userId: 'user-2' } })],
            ['another wallet on the same account', () => (mockAddress = '0xB')],
        ])('an application that answers after a switch to %s grants nothing', async (_name, switchTo) => {
            let answer!: (value: unknown) => void
            mockApplyForCard.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
            const { result, rerender } = renderHook(() => useCardFlow())
            let pending!: Promise<void>
            await act(async () => {
                pending = result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockApplyForCard).toHaveBeenCalledTimes(1)
            switchTo()
            rerender()
            await act(async () => {
                answer({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
                await pending
            })
            expect(mockGrantFunding).not.toHaveBeenCalled()
            expect(mockSerializeGrant).not.toHaveBeenCalled()
            expect(window.localStorage.getItem('card_issuance_celebration_pending_v1:user-1')).toBeNull()
            expect(result.current.applyError).toBeNull()
        })

        it('stores the fresh decision under this user and wallet only', async () => {
            mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(['rain-card-funding-access', 'user-1', '0xa'], {
                fundingMode: 'managed',
                enrollmentAllowed: true,
            })
        })

        it.each([
            ['the terms', { status: 'terms-required', isUsResident: true }, 'pendingTerms'],
            [
                'the country question',
                { status: 'country-confirmation-required', candidates: [] },
                'pendingCountryConfirmation',
            ],
        ] as const)(
            'an application answer that lands after a switch does not open %s for the next account',
            async (_n, response, field) => {
                let answer!: (value: unknown) => void
                mockApplyForCard.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
                const { result, rerender } = renderHook(() => useCardFlow())
                let pending!: Promise<void>
                await act(async () => {
                    pending = result.current.handleApply()
                })
                mockUser = { user: { userId: 'user-2' } }
                rerender()
                await act(async () => {
                    answer(response)
                    await pending
                })
                expect(result.current[field]).toBeNull()
            }
        )

        it('a country answer that lands after a wallet switch changes nothing', async () => {
            let answer!: (value: unknown) => void
            mockApplyForCard.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
            const { result, rerender } = renderHook(() => useCardFlow())
            let pending!: Promise<void>
            await act(async () => {
                pending = result.current.handleConfirmCountry('US')
            })
            mockAddress = '0xB'
            rerender()
            await act(async () => {
                answer({ status: 'terms-required', isUsResident: true })
                await pending
            })
            expect(result.current.pendingTerms).toBeNull()
            expect(result.current.applyError).toBeNull()
        })

        it('an accept handler kept from before a switch reads, applies and grants nothing', async () => {
            const { result, rerender } = renderHook(() => useCardFlow())
            const acceptForA = result.current.handleAcceptTerms
            mockUser = { user: { userId: 'user-2' } }
            rerender()
            await act(async () => {
                await acceptForA(CONSENT)
            })
            expect(mockGetFundingAccess).not.toHaveBeenCalled()
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(mockGrantFunding).not.toHaveBeenCalled()
            expect(mockQueryClient.setQueryData).not.toHaveBeenCalled()
        })

        it('a switch while the decision is read writes nothing to the cache for either account', async () => {
            let release!: () => void
            mockGetFundingAccess.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        release = () => resolve({ fundingMode: 'managed', enrollmentAllowed: true })
                    })
            )
            const { result, rerender } = renderHook(() => useCardFlow())
            let pending!: Promise<void>
            act(() => {
                pending = result.current.handleAcceptTerms(CONSENT)
            })
            mockAddress = '0xB'
            rerender()
            await act(async () => {
                release()
                await pending
            })
            expect(mockQueryClient.setQueryData).not.toHaveBeenCalled()
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(mockGrantFunding).not.toHaveBeenCalled()
        })

        // The person read and accepted the managed text; enrollment closed
        // before they pressed Continue. Nothing is applied or signed, and the
        // existing permission is never signed in its place.
        it('enrollment closed while the managed terms were open: no application, no signature, accept again', async () => {
            mockGetFundingAccess.mockResolvedValue({ fundingMode: 'legacy', enrollmentAllowed: false })
            mockOverview = { status: { contractAddress: '0xc', coordinatorAddress: '0xd' }, cards: [] }
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(mockGrantFunding).not.toHaveBeenCalled()
            expect(mockSerializeGrant).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe('funding.termsChanged')
            expect(result.current.isIssuing).toBe(false)
        })

        it('an unreadable decision applies and signs nothing', async () => {
            mockGetFundingAccess.mockRejectedValue(new Error('funding_access_unavailable'))
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(mockGrantFunding).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe('page.setupFailed')
        })
    })

    // An account managed funding is not open to keeps the production card
    // path: the existing agreement, the existing permission, the existing gates.
    describe('handleAcceptTerms — the existing card path', () => {
        const CONTRACTS = { contractAddress: '0xcollateral', coordinatorAddress: '0xcoordinator' }
        beforeEach(() => {
            mockGetFundingAccess.mockResolvedValue({ fundingMode: 'legacy', enrollmentAllowed: false })
        })

        it('re-issue with contracts in place signs the existing permission first, then applies with it', async () => {
            const order: string[] = []
            mockOverview = { status: { ...CONTRACTS, hasApplication: true, railStatus: 'ENABLED' }, cards: [] }
            mockSerializeGrant.mockImplementation(async () => {
                order.push('sign')
                return { ok: true, serialized: 'SERIALIZED_APPROVAL' }
            })
            mockApplyForCard.mockImplementation(async () => {
                order.push('apply')
                return { status: 'pending', rainUserId: 'ru-1', message: 'submitted' }
            })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(null)
            })
            expect(order).toEqual(['sign', 'apply'])
            expect(mockSerializeGrant).toHaveBeenCalledWith({ userId: 'user-1', connectedAddress: '0xA' })
            expect(mockApplyForCard).toHaveBeenCalledWith({
                termsAccepted: true,
                acceptedDocuments: [],
                serializedApproval: 'SERIALIZED_APPROVAL',
            })
            expect(mockGrantFunding).not.toHaveBeenCalled()
        })

        it.each([
            ['cancelled', 'user-cancelled', 'page.setupCancelled'],
            ['failed', 'unexpected', 'page.setupFailed'],
        ])('a %s signature creates no card', async (_name, kind, message) => {
            mockOverview = { status: { ...CONTRACTS, hasApplication: true, railStatus: 'ENABLED' }, cards: [] }
            mockSerializeGrant.mockResolvedValue({ ok: false, error: { kind, message: 'x' } })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(null)
            })
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe(message)
            expect(result.current.isIssuing).toBe(false)
        })

        it('a first application with no contracts yet applies without a permission (Home asks after issuance)', async () => {
            mockOverview = { status: { hasApplication: false }, cards: [] }
            mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(null)
            })
            expect(mockSerializeGrant).not.toHaveBeenCalled()
            expect(mockApplyForCard).toHaveBeenCalledWith({ termsAccepted: true, acceptedDocuments: [] })
            expect(mockGrantFunding).not.toHaveBeenCalled()
        })

        it('keeps the $10 balance gate for a new application', async () => {
            mockFunded = false
            mockOverview = { status: { hasApplication: false }, cards: [] }
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(null)
            })
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(result.current.fundingRequired).toBe(true)
        })

        it('the $10 gate stops a new application with contracts before anything is signed', async () => {
            mockFunded = false
            mockOverview = { status: { ...CONTRACTS, hasApplication: false }, cards: [] }
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(null)
            })
            expect(mockSerializeGrant).not.toHaveBeenCalled()
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(result.current.fundingRequired).toBe(true)
        })

        it('an account that became managed while these terms were open is never given the existing permission', async () => {
            mockGetFundingAccess.mockResolvedValue({ fundingMode: 'managed', enrollmentAllowed: false })
            mockOverview = { status: { ...CONTRACTS, hasApplication: true, railStatus: 'ENABLED' }, cards: [] }
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(null)
            })
            expect(mockSerializeGrant).not.toHaveBeenCalled()
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe('funding.termsChanged')
        })

        it('an approval signed for one wallet is never sent after a switch to another', async () => {
            let signed!: (value: unknown) => void
            mockSerializeGrant.mockImplementation(() => new Promise((resolve) => (signed = resolve)))
            mockOverview = { status: { ...CONTRACTS, hasApplication: true, railStatus: 'ENABLED' }, cards: [] }
            const { result, rerender } = renderHook(() => useCardFlow())
            let pending!: Promise<void>
            await act(async () => {
                pending = result.current.handleAcceptTerms(null)
            })
            expect(mockSerializeGrant).toHaveBeenCalledTimes(1)
            mockAddress = '0xB'
            rerender()
            await act(async () => {
                signed({ ok: true, serialized: 'SIGNED_FOR_A' })
                await pending
            })
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(result.current.applyError).toBeNull()
        })

        it('a switch of account while the decision is read applies and signs nothing', async () => {
            let release!: () => void
            mockGetFundingAccess.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        release = () => resolve({ fundingMode: 'legacy', enrollmentAllowed: false })
                    })
            )
            mockOverview = { status: { ...CONTRACTS, hasApplication: true, railStatus: 'ENABLED' }, cards: [] }
            const { result, rerender } = renderHook(() => useCardFlow())
            let pending!: Promise<void>
            act(() => {
                pending = result.current.handleAcceptTerms(null)
            })
            mockUser = { user: { userId: 'user-2' } }
            rerender()
            await act(async () => {
                release()
                await pending
            })
            expect(mockSerializeGrant).not.toHaveBeenCalled()
            expect(mockApplyForCard).not.toHaveBeenCalled()
        })
    })

    it('fires the abandonment event only when sumsub closes without completing', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 'tok-1' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        act(() => {
            result.current.handleSumsubClose()
        })
        expect(result.current.sumsubToken).toBeNull()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SUMSUB_CLOSED)
    })
})

describe('useCardFlow — overview status reconciliation', () => {
    const overview = (railStatus: string, applicationStatus: string) => ({
        cards: [],
        status: { hasApplication: true, railStatus, applicationStatus },
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockUserFetching = 0
        mockUser = { user: { userId: 'user-1' } }
        mockState = 'pending'
        mockOverviewLoading = false
        mockOverview = undefined
        mockRainRails = []
    })

    it('does not invalidate on the first successful overview or unchanged polls', () => {
        const { rerender } = renderHook(() => useCardFlow())
        mockOverview = overview('PENDING', 'pending')
        rerender()
        mockOverview = overview('PENDING', 'pending')
        rerender()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it.each([
        ['raw application only', 'PENDING', 'needsInformation'],
        ['rail only', 'REQUIRES_INFORMATION', 'pending'],
        ['both fields', 'REQUIRES_INFORMATION', 'needsInformation'],
    ])('invalidates the current user once when %s changes', (_label, railStatus, applicationStatus) => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockOverview = overview(railStatus, applicationStatus)
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] })
        mockOverview = overview(railStatus, applicationStatus)
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'Review' } }]
        rerender()
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('does not treat a missing overview and recovery of the same data as transitions', () => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockOverview = undefined
        rerender()
        mockOverview = overview('PENDING', 'pending')
        rerender()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
        mockOverview = overview('PENDING', 'needsInformation')
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('starts a fresh status baseline for another authenticated user', () => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockUser = { user: { userId: 'user-2' } }
        mockOverview = overview('PENDING', 'pending')
        rerender()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
        mockOverview = overview('ENABLED', 'approved')
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] })
    })

    it.each(['REQUIRES_INFORMATION', 'REJECTED', 'REQUIRES_SUPPORT'])(
        'refreshes a possibly older profile once when the first overview shows %s',
        (railStatus) => {
            mockOverview = overview(railStatus, 'needsInformation')
            const { rerender } = renderHook(() => useCardFlow())
            expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] })
            rerender()
            mockOverview = overview(railStatus, 'needsInformation')
            rerender()
            expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        }
    )

    it('refreshes on first sight for each newly authenticated user whose screen shows a reason', () => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockUser = { user: { userId: 'user-2' } }
        mockOverview = overview('REQUIRES_INFORMATION', 'needsInformation')
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })
})

describe('useCardFlow — state viewed analytics', () => {
    const stateEvents = () => mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CARD_STATE_VIEWED)

    beforeEach(() => {
        jest.clearAllMocks()
        mockUserFetching = 0
        mockUser = { user: { userId: 'user-1' } }
        mockState = 'requires-info'
        mockOverviewLoading = false
        mockOverview = {
            cards: [],
            status: { applicationStatus: 'needsInformation', railStatus: 'REQUIRES_INFORMATION' },
        }
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'Backend prose' } }]
    })

    it('includes the raw application status and Rain card reason code', () => {
        renderHook(() => useCardFlow())
        expect(stateEvents()).toEqual([
            [
                ANALYTICS_EVENTS.CARD_STATE_VIEWED,
                {
                    state: 'requires-info',
                    previous_state: null,
                    application_status: 'needsInformation',
                    reason_code: 'card_needs_review',
                },
            ],
        ])
    })

    it('uses explicit nulls when overview status and Rain card reason are absent', () => {
        mockOverview = undefined
        mockRainRails = []
        renderHook(() => useCardFlow())
        expect(stateEvents()).toEqual([
            [
                ANALYTICS_EVENTS.CARD_STATE_VIEWED,
                {
                    state: 'requires-info',
                    previous_state: null,
                    application_status: null,
                    reason_code: null,
                },
            ],
        ])
    })

    it('skips loading and deduplicates the state even when capabilities refresh', () => {
        mockOverviewLoading = true
        const { rerender } = renderHook(() => useCardFlow())
        expect(stateEvents()).toHaveLength(0)
        mockOverviewLoading = false
        rerender()
        expect(stateEvents()).toHaveLength(1)
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'New prose' } }]
        rerender()
        expect(stateEvents()).toHaveLength(1)
        mockState = 'pending'
        rerender()
        expect(stateEvents()).toHaveLength(2)
        expect(stateEvents()[1][1]).toEqual({
            state: 'pending',
            previous_state: 'requires-info',
            application_status: 'needsInformation',
            reason_code: 'card_needs_review',
        })
    })

    it('waits for an in-flight profile refresh so the reason matches the new state', () => {
        mockUserFetching = 1
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_rejected', userMessage: 'Stale prose' } }]
        const { rerender } = renderHook(() => useCardFlow())
        expect(stateEvents()).toHaveLength(0)
        mockUserFetching = 0
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'Fresh prose' } }]
        rerender()
        expect(stateEvents()).toEqual([
            [
                ANALYTICS_EVENTS.CARD_STATE_VIEWED,
                {
                    state: 'requires-info',
                    previous_state: null,
                    application_status: 'needsInformation',
                    reason_code: 'card_needs_review',
                },
            ],
        ])
    })
})

describe('useCardFlow — balance known', () => {
    beforeEach(() => {
        mockBalance = 10_000_000n
        mockOverview = { status: { hasApplication: false }, cards: [], balance: null }
    })

    it('treats the balance as known only once a value was read', () => {
        mockBalance = undefined
        const { result, rerender } = renderHook(() => useCardFlow())
        expect(result.current.isBalanceKnown).toBe(false)
        mockBalance = 0n
        rerender()
        expect(result.current.isBalanceKnown).toBe(true)
    })

    it('waits for the Rain half of the balance', () => {
        mockBalance = 0n
        mockOverview = undefined
        const { result, rerender } = renderHook(() => useCardFlow())
        expect(result.current.isBalanceKnown).toBe(false)
        mockOverview = {
            status: { hasApplication: false, railStatus: 'ENABLED' },
            cards: [],
            balance: null,
            balanceUnavailable: true,
        }
        rerender()
        expect(result.current.isBalanceKnown).toBe(false)
        mockOverview = { ...mockOverview, balance: { spendingPower: 2500 }, balanceUnavailable: false }
        rerender()
        expect(result.current.isBalanceKnown).toBe(true)
    })
})
