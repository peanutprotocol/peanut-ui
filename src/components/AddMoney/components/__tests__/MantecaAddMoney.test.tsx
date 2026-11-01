jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: 'legacy-user' },
            capabilities: mockCapabilityBlock(),
            identityVerification: { status: mockIsIdentityVerified ? 'verified' : 'not_started' },
        },
        fetchUser: mockFetchUser,
    }),
}))
/**
 * MantecaAddMoney — denomination defaulting + URL round-trip.
 *
 * The input must open in the country's LOCAL currency (ARS/BRL) — matching the
 * withdraw flow — unless the URL explicitly pins one (?currency=USD). This was
 * silently narrowed to Brazil-only once (3ab066885); this suite pins it.
 * The ?currency= param stores ISO codes while AmountInput reports display
 * symbols ('R$'), so the write-back must map symbol → code or the enum parser
 * silently drops it. Nested primitives are stubbed so only this component's
 * own logic is under test.
 */
import React from 'react'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { RailCapability } from '@/types/capabilities'
import { act, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
// jest.mock calls are hoisted above this import, so the mocks below apply to it
import MantecaAddMoney from '../MantecaAddMoney'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

const mockParams: Record<string, string> = {}
jest.mock('next/navigation', () => ({
    useParams: () => mockParams,
    useSearchParams: () => ({ get: () => null }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    // the residence screen renders NavHeader, whose maintenance banner reads it
    usePathname: () => '/add-money',
}))

const mockQueryState: Record<string, unknown> = {}
const mockSetQueryState = jest.fn((updates: Record<string, unknown>) => {
    Object.entries(updates).forEach(([k, v]) => {
        mockQueryState[k] = v
    })
})
jest.mock('nuqs', () => ({
    useQueryStates: () => [mockQueryState, mockSetQueryState],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
}))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))

jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [
        { type: 'country', id: 'AR', path: 'argentina', title: 'Argentina', currency: 'ARS' },
        { type: 'country', id: 'BR', path: 'brazil', title: 'Brazil', currency: 'BRL' },
    ],
}))

jest.mock('@/utils/native-routes', () => ({ addMoneyCountryUrl: (path: string) => `/add-money/${path}` }))

jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: (code: string | null) => ({
        code,
        symbol: code === 'BRL' ? 'R$' : code,
        price: { buy: 1000, sell: 1000 },
        isLoading: false,
        isError: false,
    }),
}))

let mockCapabilitiesLoading = false
let mockResidence: string | null = null
let mockRails: RailCapability[] = []
let mockClosedCountries = new Set<string>()
let mockCapabilityRevision = 0
const mockCapabilityListeners = new Set<() => void>()
const mockSubscribeCapabilities = (listener: () => void) => {
    mockCapabilityListeners.add(listener)
    return () => {
        mockCapabilityListeners.delete(listener)
    }
}
const mockCapabilityBlock = () =>
    withFeatureReport(
        { rails: mockRails, nextActions: [], restrictions: [] },
        {
            identity: { status: mockIsIdentityVerified ? 'verified' : 'not_started' },
            residence: mockResidence,
            mantecaClosedCountries: mockClosedCountries,
        }
    )
const mockFetchUser = jest.fn(async () => {
    mockClosedCountries = new Set([mockParams.country === 'brazil' ? 'BR' : 'AR'])
    mockCapabilityRevision += 1
    mockCapabilityListeners.forEach((listener) => listener())
    return { capabilities: mockCapabilityBlock() }
})
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => {
        jest.requireActual('react').useSyncExternalStore(mockSubscribeCapabilities, () => mockCapabilityRevision)
        return {
            capabilities: mockCapabilityBlock(),
            rails: mockRails,
            nextActions: [],
            isLoading: mockCapabilitiesLoading,
        }
    },
}))
let mockIsIdentityVerified = true
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: mockIsIdentityVerified }),
}))
let mockIsVerifiedForCountry = true
jest.mock('@/utils/regions.utils', () => ({ isVerifiedForCountry: () => mockIsVerifiedForCountry }))
let mockRejection: Record<string, unknown> = { state: 'happy' }
jest.mock('@/utils/provider-rejection.utils', () => ({ deriveProviderRejection: () => mockRejection }))
const mockKycFlow = {
    error: null,
    isLoading: false,
    handleFixableRejection: jest.fn(),
    handleSelfHealResubmit: jest.fn(),
    handleRestartIdentity: jest.fn(),
    handleInitiateKyc: jest.fn(),
}
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => mockKycFlow,
}))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ isBlocking: false, isWarning: false, currency: 'USD' }),
}))

const mockDeposit = jest.fn()
jest.mock('@/services/manteca', () => ({ mantecaApi: { deposit: (...args: unknown[]) => mockDeposit(...args) } }))
const mockOpenSupportWithMessage = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn(), openSupportWithMessage: mockOpenSupportWithMessage }),
    useModalsContextOptional: () => null,
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))

jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
// captures the KYC modal wiring so a test can drive its CTA
type KycModalProps = {
    visible: boolean
    variant?: string
    reasonCode?: string
    regionName?: string
    onClose: () => void
    onVerify: () => Promise<void>
}
let lastKycModalProps: KycModalProps | null = null
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: KycModalProps) => {
        lastKycModalProps = props
        return null
    },
}))
jest.mock('@/components/AddMoney/components/MantecaDepositShareDetails', () => ({
    __esModule: true,
    default: () => <div data-testid="share-details" />,
}))
jest.mock('@/components/AddMoney/components/MantecaPixQrDeposit', () => ({
    __esModule: true,
    default: () => <div data-testid="pix-qr" />,
}))

// records the props MantecaAddMoney hands to the amount step
type InputStepProps = {
    initialDenomination?: string
    setCurrentDenomination: (denomination: string) => void
    onSubmit: () => Promise<void>
    error?: string | null
    providerFinePrint?: React.ReactElement<{ providerId: string }>
}
let lastInputStepProps: InputStepProps | null = null
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: (props: InputStepProps) => {
        lastInputStepProps = props
        return <div data-testid="input-amount-step" data-denomination={props.initialDenomination} />
    },
}))

const setCountry = (path: string) => {
    mockParams.country = path
}

beforeEach(() => {
    Object.keys(mockQueryState).forEach((k) => delete mockQueryState[k])
    mockSetQueryState.mockClear()
    lastInputStepProps = null
    lastKycModalProps = null
    mockIsVerifiedForCountry = true
    mockIsIdentityVerified = true
    mockCapabilitiesLoading = false
    mockResidence = null
    mockRails = []
    mockClosedCountries = new Set()
    mockFetchUser.mockClear()
    mockRejection = { state: 'happy' }
    Object.values(mockKycFlow).forEach((v) => typeof v === 'function' && (v as jest.Mock).mockClear())
    mockDeposit.mockReset()
    mockOpenSupportWithMessage.mockReset()
})

describe('denomination default', () => {
    test('Argentina opens in ARS (local currency), not USD', () => {
        setCountry('argentina')
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toHaveAttribute('data-denomination', 'ARS')
    })

    test('Brazil opens in BRL (local currency)', () => {
        setCountry('brazil')
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toHaveAttribute('data-denomination', 'BRL')
    })

    test('an explicit ?currency=USD deep-link still wins', () => {
        setCountry('argentina')
        mockQueryState.currency = 'USD'
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toHaveAttribute('data-denomination', 'USD')
    })
})

describe('provider fine print', () => {
    test.each([
        ['argentina', 'manteca-ar'],
        ['brazil', 'manteca-br'],
    ])('%s names the matching Manteca entity under the amount', (path, providerId) => {
        setCountry(path)
        render(<MantecaAddMoney />)

        expect(lastInputStepProps!.providerFinePrint?.props.providerId).toBe(providerId)
    })
})

describe('denomination change → URL write-back', () => {
    test("Brazil maps AmountInput's display symbol R$ to the ISO code BRL", () => {
        setCountry('brazil')
        render(<MantecaAddMoney />)

        lastInputStepProps!.setCurrentDenomination('R$')

        expect(mockSetQueryState).toHaveBeenCalledWith({ currency: 'BRL' })
    })

    test('toggling to USD writes USD', () => {
        setCountry('argentina')
        render(<MantecaAddMoney />)

        lastInputStepProps!.setCurrentDenomination('USD')

        expect(mockSetQueryState).toHaveBeenCalledWith({ currency: 'USD' })
    })
})

/**
 * Post-KYC "upload document" loop (add-money, Manteca). A rail that needs a
 * specific Sumsub RFI (source of funds, PEP/FEP) carries a `sumsub:*` action
 * key on its verdict; the modal's CTA must hand that key to the flow instead of
 * the generic resubmit, or Sumsub opens the already-complete ID-reupload action
 * ("profile verified"), nothing is submitted, and Continue shows the same modal.
 */
describe('KYC modal — fixable Manteca rejection', () => {
    const sofRejection = {
        provider: 'MANTECA',
        state: 'fixable',
        userMessage: 'We need information about your source of funds.',
        reasonCode: 'source_of_funds',
        actionKey: 'sumsub:source_of_funds',
    }

    test('Continue on an un-upgraded rail opens the provider_rejection modal with the reason code', async () => {
        setCountry('argentina')
        mockIsVerifiedForCountry = false
        mockRejection = sofRejection
        mockQueryState.amount = '100'
        render(<MantecaAddMoney />)

        await act(() => lastInputStepProps!.onSubmit())

        expect(lastKycModalProps!.visible).toBe(true)
        expect(lastKycModalProps!.variant).toBe('provider_rejection')
        expect(lastKycModalProps!.reasonCode).toBe('source_of_funds')
    })

    test('the CTA hands the whole rejection (incl. actionKey) to handleFixableRejection', async () => {
        setCountry('argentina')
        mockIsVerifiedForCountry = false
        mockRejection = sofRejection
        render(<MantecaAddMoney />)

        await act(() => lastInputStepProps!.onSubmit())
        await act(() => lastKycModalProps!.onVerify())

        expect(mockKycFlow.handleFixableRejection).toHaveBeenCalledWith(sofRejection)
        expect(mockKycFlow.handleSelfHealResubmit).not.toHaveBeenCalled()
        expect(mockKycFlow.handleInitiateKyc).not.toHaveBeenCalled()
    })
})

// The rail the API sends when Manteca's onboarding ID check failed or the ID expired: a step, carrying the restart.
describe('KYC modal — Manteca asks for a new ID', () => {
    const { deriveProviderRejection } = jest.requireActual('@/utils/provider-rejection.utils')
    const mantecaIdRequest = (reason: string, resolved: boolean): RailCapability => {
        const restart = { key: 'restart-identity', kind: 'restart-identity' as const, purpose: reason }
        return {
            id: 'manteca.bank_transfer_ar',
            provider: 'manteca',
            method: 'BANK_TRANSFER_AR',
            channel: 'bank',
            country: 'AR',
            currency: 'ARS',
            status: 'requires-info',
            blockingActions: [restart.key],
            reason: { code: reason, userMessage: 'Your ID has expired.' },
            ...(resolved
                ? {
                      resolved: {
                          status: 'blocked' as const,
                          blocking: {
                              code: reason,
                              userMessage: 'Your ID has expired.',
                              selfHealable: true,
                              selfHealKind: 'restart-identity' as const,
                          },
                          nextAction: restart,
                      },
                  }
                : {}),
        }
    }

    test.each([
        ['id_expired', true],
        ['id_verification_failed', true],
        ['id_expired', false],
    ])(
        'an ID Manteca asks for again (%s, verdict sent: %s) opens the identity restart, never a resubmit',
        async (reason, resolved) => {
            setCountry('argentina')
            mockIsVerifiedForCountry = false
            mockRejection = deriveProviderRejection([mantecaIdRequest(reason, resolved)], 'MANTECA', [
                { key: 'restart-identity', kind: 'restart-identity', purpose: reason },
            ])
            render(<MantecaAddMoney />)

            expect(lastKycModalProps!.visible).toBe(true)
            expect(lastKycModalProps!.variant).toBe('restart_identity')
            expect(lastKycModalProps!.reasonCode).toBe(reason)
            await act(() => lastKycModalProps!.onVerify())

            expect(mockKycFlow.handleRestartIdentity).toHaveBeenCalled()
            expect(mockKycFlow.handleFixableRejection).not.toHaveBeenCalled()
            expect(mockKycFlow.handleSelfHealResubmit).not.toHaveBeenCalled()
            expect(mockKycFlow.handleInitiateKyc).not.toHaveBeenCalled()
        }
    )
})

/**
 * The gate comes BEFORE the amount. Manteca mints a CVU/QR for an exact locked
 * amount, so the amount screen has to stay first among the coordinates — but a
 * user who cannot deposit should learn it on arrival, not after typing a number.
 * The amount step stays mounted underneath so a dismissed drawer leaves a screen
 * that explains itself. Title copy is covered in InitiateKycModal.countryPayments.
 */
describe('identity gate on arrival', () => {
    test('an unverified user lands on the amount step with the gate already open', () => {
        setCountry('argentina')
        mockIsVerifiedForCountry = false
        mockIsIdentityVerified = false
        render(<MantecaAddMoney />)

        expect(lastKycModalProps!.visible).toBe(true)
        expect(lastKycModalProps!.variant).toBe('country_payments')
        expect(lastKycModalProps!.regionName).toBe('Argentina')
        // the amount input is underneath, not replaced
        expect(screen.getByTestId('input-amount-step')).toBeInTheDocument()
        expect(mockDeposit).not.toHaveBeenCalled()
    })

    test('a verified user sees no gate', () => {
        setCountry('argentina')
        render(<MantecaAddMoney />)

        expect(lastKycModalProps!.visible).toBe(false)
    })

    test('no gate flashes while the capabilities are still loading', () => {
        setCountry('argentina')
        mockIsVerifiedForCountry = false
        mockCapabilitiesLoading = true
        render(<MantecaAddMoney />)

        expect(lastKycModalProps!.visible).toBe(false)
    })

    test('Continue re-opens the gate after the user dismissed it', async () => {
        setCountry('argentina')
        mockIsVerifiedForCountry = false
        mockIsIdentityVerified = false
        render(<MantecaAddMoney />)

        act(() => lastKycModalProps!.onClose())
        expect(lastKycModalProps!.visible).toBe(false)

        await act(() => lastInputStepProps!.onSubmit())

        expect(lastKycModalProps!.visible).toBe(true)
    })

    test('a dismissed gate stays closed on re-render', () => {
        setCountry('argentina')
        mockIsVerifiedForCountry = false
        const { rerender } = render(<MantecaAddMoney />)

        act(() => lastKycModalProps!.onClose())
        rerender(<MantecaAddMoney />)

        expect(lastKycModalProps!.visible).toBe(false)
    })
})

describe('Manteca account rejection during deposit', () => {
    test('a report closing the BR local account shows the closure on first render without a deposit attempt', () => {
        setCountry('brazil')
        mockClosedCountries = new Set(['BR'])
        render(<MantecaAddMoney />)

        expect(screen.getByText(en.errors.mantecaAccountRejected)).toBeInTheDocument()
        expect(screen.getByText(/You can still pay with QR/i)).toBeInTheDocument()
        expect(screen.queryByTestId('input-amount-step')).not.toBeInTheDocument()
        expect(screen.queryByTestId('pix-qr')).not.toBeInTheDocument()
        expect(lastKycModalProps).toBeNull()
        expect(mockDeposit).not.toHaveBeenCalled()
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    test('shows the account rejection and opens support without entering KYC or creating deposit details', async () => {
        setCountry('argentina')
        mockQueryState.amount = '100'
        mockDeposit.mockRejectedValue(
            Object.assign(
                new Error('KYC_REQUIRED: Manteca closed this account for deposits and withdrawals in this country'),
                {
                    code: 'MANTECA_ACCOUNT_REJECTED',
                    status: 403,
                }
            )
        )
        render(<MantecaAddMoney />)

        await act(() => lastInputStepProps!.onSubmit())

        expect(
            screen.getByText(/Deposits and withdrawals in this country aren’t available for your account/i)
        ).toBeInTheDocument()
        expect(screen.getByText(/You can still pay with QR/i)).toBeInTheDocument()
        expect(lastKycModalProps!.visible).toBe(false)
        expect(mockKycFlow.handleInitiateKyc).not.toHaveBeenCalled()
        expect(mockDeposit).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('share-details')).not.toBeInTheDocument()

        const support = screen.getByRole('button', { name: /contact support/i })
        await act(() => support.click())
        expect(mockOpenSupportWithMessage).toHaveBeenCalled()
    })

    test('a resolved API error body with code gets the same rejection handling, and capability refresh cannot reopen KYC', async () => {
        setCountry('argentina')
        mockQueryState.amount = '100'
        mockDeposit.mockResolvedValue({
            error: 'KYC_REQUIRED: Manteca closed this account for deposits and withdrawals in this country',
            code: 'MANTECA_ACCOUNT_REJECTED',
        })
        const view = render(<MantecaAddMoney />)

        await act(() => lastInputStepProps!.onSubmit())

        expect(screen.getByText(en.errors.mantecaAccountRejected)).toBeInTheDocument()
        expect(lastKycModalProps!.visible).toBe(false)
        expect(mockKycFlow.handleInitiateKyc).not.toHaveBeenCalled()
        expect(mockDeposit).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        mockRejection = { state: 'fixable', userMessage: 'Please verify your identity.' }
        view.rerender(<MantecaAddMoney />)
        expect(lastKycModalProps!.visible).toBe(false)
        expect(mockKycFlow.handleInitiateKyc).not.toHaveBeenCalled()
        expect(mockDeposit).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    test('rejection guidance is scoped to the country that returned it', async () => {
        setCountry('argentina')
        mockQueryState.amount = '100'
        mockDeposit.mockResolvedValue({
            error: 'Manteca closed this account for deposits and withdrawals in this country',
            code: 'MANTECA_ACCOUNT_REJECTED',
        })
        const view = render(<MantecaAddMoney />)
        await act(() => lastInputStepProps!.onSubmit())
        expect(screen.getByText(en.errors.mantecaAccountRejected)).toBeInTheDocument()

        setCountry('brazil')
        view.rerender(<MantecaAddMoney />)

        expect(screen.queryByText(en.errors.mantecaAccountRejected)).not.toBeInTheDocument()
        expect(screen.getByTestId('input-amount-step')).toBeInTheDocument()
        expect(lastKycModalProps!.visible).toBe(false)
    })
})

// An already-verified user opening a country they have not been uplifted for is
// still gated — with the cross-region copy, not the first-time one.
test('a verified user missing the regional uplift gets the cross-region gate', () => {
    setCountry('argentina')
    mockIsVerifiedForCountry = false
    render(<MantecaAddMoney />)

    expect(lastKycModalProps!.visible).toBe(true)
    expect(lastKycModalProps!.variant).toBe('cross_region')
})

/**
 * The residence rule comes before the amount and the KYC drawer. Manteca opens
 * the Argentine top-up only for an Argentine resident and rejects the rest
 * after amount + KYC, so a non-resident reads the rule on arrival — with the QR
 * route that still works from any balance — instead of sailing into a deposit
 * Manteca will refuse.
 */
describe('residence gate — Argentina', () => {
    test('a non-resident sees the residence screen, not the amount step or KYC gate', () => {
        setCountry('argentina')
        mockResidence = 'DE'
        render(<MantecaAddMoney />)

        expect(screen.queryByTestId('input-amount-step')).not.toBeInTheDocument()
        // the KYC drawer is never mounted for a non-resident
        expect(lastKycModalProps).toBeNull()
        expect(screen.getByText(/only legal residents of argentina/i)).toBeInTheDocument()
        expect(screen.getByTestId('corridor-qr-pay')).toHaveAttribute('href', '/qr-pay')
    })

    test('an Argentine resident reaches the amount step', () => {
        setCountry('argentina')
        mockResidence = 'AR'
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toBeInTheDocument()
    })
})

/**
 * Brazil's report carries the residence refusal for its first-party Manteca
 * account, which asks for a CPF. The screen renders that API answer.
 */
describe('residence gate — Brazil', () => {
    test('a non-resident sees the residence screen, with the Pix QR way in', () => {
        setCountry('brazil')
        mockResidence = 'PT'
        render(<MantecaAddMoney />)

        expect(screen.queryByTestId('input-amount-step')).not.toBeInTheDocument()
        expect(lastKycModalProps).toBeNull()
        expect(screen.getByText(/only legal residents of brazil/i)).toBeInTheDocument()
        expect(screen.getByTestId('corridor-qr-pay')).toHaveAttribute('href', '/qr-pay')
    })

    test('a Brazilian resident reaches the amount step', () => {
        setCountry('brazil')
        mockResidence = 'BR'
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toBeInTheDocument()
    })
})

/**
 * Audit C4: the gate keeps non-residents out of a flow Manteca refuses (ui#3349),
 * but a user whose rail already moves money is not refused by Manteca. The
 * Accounts row reads Available for them, so the top-up opens too — the API report supplies the same answer to both.
 */
describe('residence gate — a rail that already works', () => {
    test.each([
        ['brazil', 'brl'],
        ['argentina', 'ars'],
    ])('a non-resident with a working %s rail reaches the amount step', (country, key) => {
        setCountry(country)
        mockResidence = 'PT'
        mockRails = [
            {
                id: `manteca.${key}`,
                provider: 'manteca',
                method: key === 'brl' ? 'PIX_BR' : 'BANK_TRANSFER_AR',
                channel: 'bank',
                country: key === 'brl' ? 'BR' : 'AR',
                currency: key.toUpperCase(),
                status: 'enabled',
            },
        ]
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toBeInTheDocument()
        expect(screen.queryByText(/only legal residents/i)).not.toBeInTheDocument()
    })

    test('a rail still in progress does not lift the gate', () => {
        setCountry('brazil')
        mockResidence = 'PT'
        mockRails = [
            {
                id: 'manteca.pix_br',
                provider: 'manteca',
                method: 'PIX_BR',
                channel: 'bank',
                country: 'BR',
                currency: 'BRL',
                status: 'pending',
            },
        ]
        render(<MantecaAddMoney />)

        expect(screen.getByText(/only legal residents of brazil/i)).toBeInTheDocument()
    })

    test('the gate waits for the rails instead of refusing a depositor while they load', () => {
        setCountry('brazil')
        mockResidence = 'PT'
        mockCapabilitiesLoading = true
        render(<MantecaAddMoney />)

        expect(screen.queryByText(/only legal residents/i)).not.toBeInTheDocument()
    })
})

/**
 * The provider refuses the top-up for the account (a document it still needs).
 * The API answers a typed 422 PROVIDER_REJECTED whose `error` is the generic
 * "Unexpected error"; the screen shows what happened instead (TASK-20344).
 */
describe('provider refusal', () => {
    afterEach(() => mockDeposit.mockReset())

    test('a PROVIDER_REJECTED answer shows the refusal copy, not "Unexpected error"', async () => {
        setCountry('argentina')
        mockQueryState.amount = '10000'
        mockDeposit.mockResolvedValue({ error: 'Unexpected error', code: 'PROVIDER_REJECTED' })
        render(<MantecaAddMoney />)

        await act(() => lastInputStepProps!.onSubmit())

        expect(lastInputStepProps!.error).toBe(en.errors.providerRejected)
    })

    test('an untyped failure keeps the API text', async () => {
        setCountry('argentina')
        mockQueryState.amount = '10000'
        mockDeposit.mockResolvedValue({ error: 'Failed to create on-ramp transfer for guest.' })
        render(<MantecaAddMoney />)

        await act(() => lastInputStepProps!.onSubmit())

        expect(lastInputStepProps!.error).toBe('Failed to create on-ramp transfer for guest.')
    })
})
