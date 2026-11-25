/**
 * The card page asks for the funding permission (TASK-25099 #5). The apply tap
 * cannot carry it: the permission's spender is the collateral contract Rain
 * deploys after it approves the application. So an active card whose
 * permission the backend reports missing gets the same prompt as Home, the real
 * FundingSetupPrompt, on /card. A card that is set up, a card that is not active
 * yet, and the issued celebration show no prompt.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { CardPage } from '../CardPage'
import { useCardFlow } from '../useCardFlow'

const AUTHORIZATION = 'I authorize transfers according to the Real-Time Funding Terms.'
const CARD = { id: 'card-1', status: 'ACTIVE' }
let mockFundingStatus: 'required' | 'ready' | undefined
let mockFundingEnabled: boolean | undefined
let mockCards: Array<{ id: string; status: string }> = [CARD]

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/card',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } } }),
    useOptionalAuth: () => null,
}))
jest.mock('../useCardFlow', () => ({ useCardFlow: jest.fn() }))
jest.mock('../useCardVerificationContinuation', () => ({
    useCardVerificationContinuation: () => ({ available: false, busy: false, error: null, active: null }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: { cards: mockCards, status: {}, balance: { spendingPower: 0 } } }),
}))
jest.mock('@/hooks/useCardFundingAccess', () => ({
    useCardFundingAccess: () => ({
        access: { fundingMode: 'managed', enrollmentAllowed: false },
        setupPath: 'managed',
    }),
}))
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: ({ enabled }: { enabled?: boolean }) => {
        mockFundingEnabled = enabled
        return {
            funding: mockFundingStatus
                ? { permission: { authorizationText: AUTHORIZATION, termsVersion: 'rtf-2026-09-29' } }
                : undefined,
            status: mockFundingStatus,
            needsGrant: mockFundingStatus === undefined ? undefined : mockFundingStatus === 'required',
            isMigration: false,
            isPending: false,
            isWithdrawalInFlight: false,
            grant: jest.fn(),
            recheck: jest.fn(),
            isSubmitting: false,
            step: 'idle',
            lastError: null,
            owesReturn: false,
            returnError: null,
            continueSetup: jest.fn(),
        }
    },
}))
jest.mock('@/app/actions/sumsub', () => ({ initiateSelfHealResubmission: jest.fn() }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('../components/CardAcquisitionScreen', () => ({
    CardAcquisitionScreen: () => <div>add card screen</div>,
    CardMilestoneScreen: () => <div>card issued</div>,
}))
jest.mock('@/components/Card/ApplicationStatusScreen', () => ({
    __esModule: true,
    default: () => <div>application status</div>,
}))
jest.mock('@/components/Card/CardStopBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/YourCardScreen', () => ({ __esModule: true, default: () => <div>your card</div> }))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title }: { visible: boolean; title?: React.ReactNode }) =>
        visible ? <div data-testid="funding-prompt">{title}</div> : null,
}))

const flow = (state: string) => ({
    state,
    user: { user: { userId: 'user-1' } },
    overview: { status: { hasApplication: true, railStatus: 'ENABLED' }, cards: mockCards },
    overviewError: null,
    cardInfoError: null,
    railsForProvider: () => [],
    kycFlow: { isTerminalError: false, error: null },
    poaToken: null,
    sumsubToken: null,
    informationSession: null,
})

const prompt = () => screen.queryByTestId('funding-prompt')
const renderPage = () => render(<CardPage />, { wrapper: IntlWrapper })

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    mockFundingStatus = 'required'
    mockFundingEnabled = undefined
    mockCards = [CARD]
    ;(useCardFlow as jest.Mock).mockReturnValue(flow('active'))
})

describe('CardPage — the funding permission ask', () => {
    it('asks on an active card whose funding permission the backend reports missing', () => {
        renderPage()
        expect(screen.getByText('your card')).toBeInTheDocument()
        expect(prompt()).toHaveTextContent('Finish setting up the card')
        expect(mockFundingEnabled).toBe(true)
    })

    it('does not ask once the backend reports funding ready', () => {
        mockFundingStatus = 'ready'
        renderPage()
        expect(screen.getByText('your card')).toBeInTheDocument()
        expect(prompt()).toBeNull()
    })

    it('does not ask while the funding state is unknown', () => {
        mockFundingStatus = undefined
        renderPage()
        expect(prompt()).toBeNull()
    })

    it('does not ask before the card is active', () => {
        mockCards = []
        ;(useCardFlow as jest.Mock).mockReturnValue(flow('pending'))
        renderPage()
        expect(screen.getByText('application status')).toBeInTheDocument()
        expect(prompt()).toBeNull()
    })

    it('waits for the issued celebration to close', () => {
        window.localStorage.setItem('card_issuance_celebration_pending_v1:user-1', '1')
        renderPage()
        expect(screen.getByText('card issued')).toBeInTheDocument()
        expect(prompt()).toBeNull()
    })
})
