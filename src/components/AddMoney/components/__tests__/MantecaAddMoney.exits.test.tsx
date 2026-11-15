jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: 'legacy-user' },
            capabilities: mockCapabilityBlock(),
            identityVerification: { status: 'verified' },
        },
        fetchUser: jest.fn(),
    }),
}))
/**
 * MantecaAddMoney — the settled-deposit exit contract.
 *
 * The post-deposit screen (ARS/CVU details) is settled: the deposit is already
 * created. Its back control must LEAVE the flow, never return to the amount step — a return there lets the user start a
 * second deposit. This is where those destinations get their meaning; everything
 * else is stubbed to the thinnest thing that lets the settled step render.
 */
import React from 'react'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'

const mockRouterReplace = jest.fn()
let mockCountry = 'argentina'
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn(), prefetch: jest.fn() }),
    useParams: () => ({ country: mockCountry }),
    useSearchParams: () => ({ get: () => null }),
}))

// The flow's outermost exit (used by the amount step and now the CVU details
// screen). A shared spy makes "the settled screen left the flow" observable.
const mockSafeBack = jest.fn()
const mockReturnTo = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => mockSafeBack,
    useReturnTo: (origin: string) => () => mockReturnTo(origin),
}))

// nuqs — a plain object store, so `step` transitions are observable
const queryState: Record<string, any> = {}
const setQueryState = jest.fn((updates: Record<string, any>) => Object.assign(queryState, updates))
jest.mock('nuqs', () => ({
    useQueryStates: () => [queryState, setQueryState],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
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
const mockCapabilityBlock = () =>
    withFeatureReport(
        { rails: [], nextActions: [], restrictions: [] },
        { identity: { status: 'verified' }, residence: mockResidence }
    )
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: mockCapabilityBlock(), rails: [], nextActions: [], isLoading: false }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: true }) }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({ useMultiPhaseKycFlow: () => ({ isLoading: false, error: null }) }))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ currency: 'ARS' }),
}))
jest.mock('@/utils/regions.utils', () => ({ isVerifiedForCountry: () => true }))
// The API report is for this residence.
let mockResidence = 'AR'
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
    mockCountry = 'argentina'
    mockResidence = 'AR'
    Object.keys(queryState).forEach((k) => delete queryState[k])
    Object.assign(queryState, { amount: '250', currency: 'ARS' })
    mockDeposit.mockResolvedValue({ data: { id: 'syn-1', details: {}, stages: {} } })
})

describe('MantecaAddMoney — ARS/CVU exit', () => {
    it('leaves the flow on back from the deposit-details screen, not to the amount step', async () => {
        renderFlow()
        submitAmount()
        await waitFor(() => expect(screen.getByText('details-back')).toBeInTheDocument())

        fireEvent.click(screen.getByText('details-back'))

        expect(mockSafeBack).toHaveBeenCalled()
        expect(setQueryState).not.toHaveBeenCalledWith({ step: 'inputAmount' })
    })
})
