/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'

// ---------- navigation ----------

let mockParams: Record<string, string> = { country: 'germany' }
jest.mock('next/navigation', () => ({
    useParams: () => mockParams,
}))

jest.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: () => (key: string) => key,
}))

// ---------- contexts ----------

const mockOnrampFlow = {
    error: { showError: false, errorMessage: '' },
    setError: jest.fn(),
    onrampData: null as any,
    setOnrampData: jest.fn(),
}
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => mockOnrampFlow,
}))

const mockFetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } }, fetchUser: mockFetchUser }),
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))

// ---------- hooks ----------

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: undefined }),
}))

const mockCreateOnramp = jest.fn()
jest.mock('@/hooks/useCreateOnramp', () => ({
    GENERIC_ONRAMP_ERROR: 'generic onramp error',
    useCreateOnramp: () => ({ createOnramp: mockCreateOnramp, isLoading: false }),
}))

const mockTrackUpliftStarted = jest.fn()
jest.mock('@/hooks/useEeaUpliftFunnel', () => ({
    useEeaUpliftFunnel: () => ({
        trackStarted: mockTrackUpliftStarted,
        trackCompleted: jest.fn(),
        reset: jest.fn(),
    }),
}))

const mockSumsubFlow = {
    isLoading: false,
    error: null,
    showWrapper: false,
    handleInitiateKyc: jest.fn(),
    handleSelfHealResubmit: jest.fn(),
    handleRestartIdentity: jest.fn(),
}
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => mockSumsubFlow,
}))

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

let mockGate: any = { kind: 'ready' }
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: () => mockGate }),
}))

jest.mock('@/hooks/useBankRegionIntent', () => ({
    useBankRegionIntent: () => (region: string) => `intent:${region}`,
}))

const mockPendingModalOpen = jest.fn()
jest.mock('@/hooks/useWaitingOnProviderModal', () => ({
    useWaitingOnProviderModal: () => ({
        isOpen: false,
        open: mockPendingModalOpen,
        close: jest.fn(),
        message: null,
    }),
}))

// intercept passes straight through unless the test overrides it
const mockAdvisoryIntercept = jest.fn((proceed: () => void) => proceed())
jest.mock('@/hooks/useAdvisoryPreempt', () => ({
    useAdvisoryPreempt: () => ({ intercept: mockAdvisoryIntercept, modalProps: {} }),
}))

const mockGuardWithTos = jest.fn()
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: mockGuardWithTos, showBridgeTos: false, hideTos: jest.fn() }),
}))

jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({
        price: { buy: 1, sell: 1 },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }),
}))

const mockUseLimitsValidation = jest.fn()
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: (...args: any[]) => mockUseLimitsValidation(...args),
}))

// ---------- consts / utils ----------

jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [
        { type: 'country', id: 'DE', path: 'germany', region: 'europe' },
        { type: 'country', id: 'US', path: 'us', region: 'north-america' },
    ],
}))

jest.mock('@/constants/countryCurrencyMapping', () => ({
    __esModule: true,
    default: [{ country: 'germany', currencyCode: 'EUR', path: 'germany' }],
    isNonEuroSepaCountry: jest.fn(() => false),
    isUKCountry: jest.fn(() => false),
}))

jest.mock('@/utils/bridge.utils', () => ({
    getCurrencyConfig: jest.fn(() => ({ currency: 'usd' })),
    getMinimumAmount: jest.fn(() => 5),
    railJurisdictionForBank: jest.fn(() => 'EU'),
}))

// the real step rule, exercised end-to-end
jest.mock('@/utils/capability-gate', () => jest.requireActual('@/utils/capability-gate'))

jest.mock('@/utils/eea-uplift.utils', () => ({
    upliftTriggerFromGate: jest.fn(() => null),
    upliftTriggerFromAdvisory: jest.fn(() => null),
}))

jest.mock('@/utils/general.utils', () => ({
    formatAmount: jest.fn((v: any) => v?.toString() ?? ''),
}))

jest.mock('@/utils/native-routes', () => ({
    addMoneyCountryUrl: (path: string) => `/add-money/${path}`,
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        DEPOSIT_AMOUNT_ENTERED: 'deposit_amount_entered',
        DEPOSIT_CONFIRMED: 'deposit_confirmed',
        DEPOSIT_FAILED: 'deposit_failed',
    },
}))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: any[]) => mockCapture(...args) },
}))

import { useBridgeBankFlow } from '../useBridgeBankFlow'

const renderFlow = (search = '', onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
    renderHook(() => useBridgeBankFlow(), { wrapper: withNuqsTestingAdapter({ searchParams: search, onUrlUpdate }) })

describe('useBridgeBankFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockParams = { country: 'germany' }
        mockGate = { kind: 'ready' }
        mockOnrampFlow.error = { showError: false, errorMessage: '' }
        mockOnrampFlow.onrampData = null
        mockOnrampFlow.setOnrampData = jest.fn((data) => {
            mockOnrampFlow.onrampData = data
        })
        mockAdvisoryIntercept.mockImplementation((proceed: () => void) => proceed())
        mockUseLimitsValidation.mockReturnValue({ isBlocking: false, isWarning: false })
    })

    it('resolves the selected country from the path and fetches the user on mount', () => {
        const { result } = renderFlow()
        expect(result.current.selectedCountry?.id).toBe('DE')
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it('steers a missing step to inputAmount when the gate is ready', async () => {
        const events: UrlUpdateEvent[] = []
        renderFlow('', (e) => events.push(e))
        await waitFor(() => expect(events.at(-1)?.searchParams.get('step')).toBe('inputAmount'))
    })

    it('steers a stale inputAmount step back to verify when identity is needed', async () => {
        mockGate = { kind: 'needs-identity' }
        const events: UrlUpdateEvent[] = []
        renderFlow('?step=inputAmount&amount=100', (e) => events.push(e))
        await waitFor(() => expect(events.at(-1)?.searchParams.get('step')).toBe('verify'))
    })

    it('flags an amount below the country minimum as a validation error', () => {
        const { result } = renderFlow('?step=inputAmount&amount=2')
        expect(result.current.validationError).toBe('errors.minimumDeposit')
        expect(result.current.minimumAmount).toBe(5)
    })

    it('Continue on a ready gate records the amount and opens the confirmation modal', () => {
        const { result } = renderFlow('?step=inputAmount&amount=100')

        act(() => result.current.handleAmountContinue())

        expect(mockCapture).toHaveBeenCalledWith('deposit_amount_entered', {
            amount_usd: 100,
            method_type: 'bank',
            country: 'germany',
        })
        expect(result.current.showWarningModal).toBe(true)
    })

    it('Continue on a pending gate opens the wait modal, never the KYC modal', () => {
        mockGate = { kind: 'pending' }
        const { result } = renderFlow('?step=inputAmount&amount=100')

        act(() => result.current.handleAmountContinue())

        expect(mockPendingModalOpen).toHaveBeenCalled()
        expect(result.current.showKycModal).toBe(false)
    })

    it('Continue on an accept-tos gate routes through the ToS guard', () => {
        mockGate = { kind: 'accept-tos' }
        const { result } = renderFlow('?step=inputAmount&amount=100')

        act(() => result.current.handleAmountContinue())

        expect(mockGuardWithTos).toHaveBeenCalled()
        expect(result.current.showKycModal).toBe(false)
    })

    it('Continue on a verifiable gate opens the KYC modal', () => {
        mockGate = { kind: 'needs-identity' }
        const { result } = renderFlow('?step=inputAmount&amount=100')

        act(() => result.current.handleAmountContinue())

        expect(result.current.showKycModal).toBe(true)
        expect(mockPendingModalOpen).not.toHaveBeenCalled()
    })

    it('Continue on a loading gate silently no-ops', () => {
        mockGate = { kind: 'loading' }
        const { result } = renderFlow('?step=inputAmount&amount=100')

        act(() => result.current.handleAmountContinue())

        expect(result.current.showKycModal).toBe(false)
        expect(result.current.showWarningModal).toBe(false)
        expect(mockPendingModalOpen).not.toHaveBeenCalled()
    })

    it('confirm creates the onramp with the displayed amount and moves to showDetails', async () => {
        mockCreateOnramp.mockResolvedValue({ transferId: 'transfer-123' })
        const events: UrlUpdateEvent[] = []
        const { result } = renderFlow('?step=inputAmount&amount=100', (e) => events.push(e))

        await act(async () => {
            await result.current.handleWarningConfirm()
        })

        expect(mockCreateOnramp).toHaveBeenCalledWith({
            amount: '100',
            country: expect.objectContaining({ id: 'DE' }),
        })
        expect(mockOnrampFlow.setOnrampData).toHaveBeenCalledWith({ transferId: 'transfer-123' })
        expect(mockCapture).toHaveBeenCalledWith('deposit_confirmed', {
            amount_usd: 100,
            method_type: 'bank',
            country: 'germany',
        })
        await waitFor(() => expect(events.at(-1)?.searchParams.get('step')).toBe('showDetails'))
    })

    it('a failed onramp surfaces the thrown message and records the failure', async () => {
        mockCreateOnramp.mockRejectedValue(new Error('Service unavailable'))
        const events: UrlUpdateEvent[] = []
        const { result } = renderFlow('?step=inputAmount&amount=100', (e) => events.push(e))

        await act(async () => {
            await result.current.handleWarningConfirm()
        })

        expect(mockCapture).toHaveBeenCalledWith('deposit_failed', {
            method_type: 'bank',
            error_message: 'Service unavailable',
        })
        expect(mockOnrampFlow.setError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'Service unavailable',
        })
        expect(events.every((e) => e.searchParams.get('step') !== 'showDetails')).toBe(true)
    })

    it('handleVerify routes each gate to its own KYC action', async () => {
        mockGate = { kind: 'restart-identity' }
        let { result } = renderFlow('?step=verify')
        await act(async () => result.current.handleVerify())
        expect(mockSumsubFlow.handleRestartIdentity).toHaveBeenCalled()

        mockGate = { kind: 'fixable-rejection' }
        ;({ result } = renderFlow('?step=verify'))
        await act(async () => result.current.handleVerify())
        expect(mockSumsubFlow.handleSelfHealResubmit).toHaveBeenCalledWith('BRIDGE')

        mockGate = { kind: 'needs-identity' }
        ;({ result } = renderFlow('?step=verify'))
        await act(async () => result.current.handleVerify())
        expect(mockSumsubFlow.handleInitiateKyc).toHaveBeenCalledWith('intent:europe', undefined, undefined, 'DE')
    })

    it('bounces a deep-linked showDetails without onramp data back to inputAmount', async () => {
        const events: UrlUpdateEvent[] = []
        renderFlow('?step=showDetails', (e) => events.push(e))
        await waitFor(() => expect(events.at(-1)?.searchParams.get('step')).toBe('inputAmount'))
    })
})
