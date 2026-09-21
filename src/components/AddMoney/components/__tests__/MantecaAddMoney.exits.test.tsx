/**
 * MantecaAddMoney — the settled-deposit exit contract.
 *
 * Both post-deposit screens (BRL/PIX QR and ARS/CVU details) are settled: the
 * deposit is already created. Their back/close and done controls must LEAVE the
 * flow, never return to the amount step — a return there lets the user start a
 * second deposit. This is where those destinations get their meaning; everything
 * else is stubbed to the thinnest thing that lets the settled step render.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'

const mockRouterReplace = jest.fn()
let mockCountry = 'brazil'
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn(), prefetch: jest.fn() }),
    useParams: () => ({ country: mockCountry }),
    useSearchParams: () => ({ get: () => null }),
}))

// The flow's outermost exit (used by the amount step and now the CVU details
// screen). A shared spy makes "the settled screen left the flow" observable.
const mockSafeBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockSafeBack }))

// nuqs — a plain object store, so `step` transitions are observable
const queryState: Record<string, any> = {}
const setQueryState = jest.fn((updates: Record<string, any>) => Object.assign(queryState, updates))
jest.mock('nuqs', () => ({
    useQueryStates: () => [queryState, setQueryState],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
}))

// The children: surface each exit as a button so the test can fire it.
jest.mock('@/components/AddMoney/components/MantecaPixQrDeposit', () => ({
    __esModule: true,
    default: ({ onBack, onDone }: { onBack: () => void; onDone: () => void }) => (
        <div>
            <button onClick={onDone}>child-done</button>
            <button onClick={onBack}>child-back</button>
        </div>
    ),
}))
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: ({ onSubmit }: { onSubmit: () => void }) => <button onClick={onSubmit}>submit-amount</button>,
}))
jest.mock('@/components/AddMoney/components/MantecaDepositShareDetails', () => ({
    __esModule: true,
    default: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>details-back</button>,
}))

jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))

const mockDeposit = jest.fn()
jest.mock('@/services/manteca', () => ({ mantecaApi: { deposit: (...a: unknown[]) => mockDeposit(...a) } }))

jest.mock('@/hooks/useCurrency', () => ({ useCurrency: () => ({ symbol: 'R$', price: 5 }) }))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ rails: [] }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: true }) }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({ useMultiPhaseKycFlow: () => ({ isLoading: false, error: null }) }))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ currency: 'BRL' }),
}))
jest.mock('@/utils/regions.utils', () => ({ isVerifiedForCountry: () => true }))
// the real hook reads useAuth, which throws with no provider; residence is set
// per test so Argentina clears its residence gate.
let mockResidence = ['BR']
jest.mock('@/features/deposit-accounts/useResidenceIso2s', () => ({ useResidenceIso2s: () => mockResidence }))
jest.mock('@/utils/provider-rejection.utils', () => ({ deriveProviderRejection: () => ({ state: 'none' }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// imported after the jest.mock calls above, which must be hoisted first
import MantecaAddMoney from '../MantecaAddMoney'

const renderFlow = () =>
    render(
        <IntlWrapper>
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MantecaAddMoney />
            </QueryClientProvider>
        </IntlWrapper>
    )

// Drive the real handleAmountSubmit so the settled step is populated the way it
// is in production — the settled steps render `null` without depositDetails.
const submitAmount = () => fireEvent.click(screen.getByText('submit-amount'))

beforeEach(() => {
    jest.clearAllMocks()
    mockCountry = 'brazil'
    mockResidence = ['BR']
    Object.keys(queryState).forEach((k) => delete queryState[k])
    Object.assign(queryState, { amount: '250', currency: 'BRL' })
    mockDeposit.mockResolvedValue({ data: { id: 'syn-1', details: {}, stages: {} } })
})

describe('MantecaAddMoney — BRL/PIX exits', () => {
    // The bug: a settled deposit's back sent the user to the amount input — i.e.
    // into a new deposit — instead of out of the flow.
    it('sends the user home when the PIX screen signals it is done', async () => {
        renderFlow()
        submitAmount()
        await waitFor(() => expect(screen.getByText('child-done')).toBeInTheDocument())

        fireEvent.click(screen.getByText('child-done'))

        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(setQueryState).not.toHaveBeenCalledWith({ step: 'inputAmount' })
    })

    it('leaves the flow on back — a settled deposit must not return to the amount step', async () => {
        renderFlow()
        submitAmount()
        await waitFor(() => expect(screen.getByText('child-back')).toBeInTheDocument())

        fireEvent.click(screen.getByText('child-back'))

        expect(mockSafeBack).toHaveBeenCalled()
        expect(setQueryState).not.toHaveBeenCalledWith({ step: 'inputAmount' })
    })
})

describe('MantecaAddMoney — ARS/CVU exit', () => {
    it('leaves the flow on back from the deposit-details screen, not to the amount step', async () => {
        mockCountry = 'argentina'
        mockResidence = ['AR']
        Object.assign(queryState, { currency: 'ARS' })
        renderFlow()
        submitAmount()
        await waitFor(() => expect(screen.getByText('details-back')).toBeInTheDocument())

        fireEvent.click(screen.getByText('details-back'))

        expect(mockSafeBack).toHaveBeenCalled()
        expect(setQueryState).not.toHaveBeenCalledWith({ step: 'inputAmount' })
    })
})
