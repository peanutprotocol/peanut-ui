/**
 * MantecaAddMoney — the BRL/PIX exit contract.
 *
 * The child (MantecaPixQrDeposit) has two distinct exits and this is where they get
 * their meaning: `onBack` returns to the amount step, `onDone` leaves the flow. Only
 * the destination is under test here — everything else is stubbed to the thinnest
 * thing that lets the showQR step render.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'

const mockRouterReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn(), prefetch: jest.fn() }),
    useParams: () => ({ country: 'brazil' }),
    useSearchParams: () => ({ get: () => null }),
}))

// nuqs — a plain object store, so `step` transitions are observable
const queryState: Record<string, any> = {}
const setQueryState = jest.fn((updates: Record<string, any>) => Object.assign(queryState, updates))
jest.mock('nuqs', () => ({
    useQueryStates: () => [queryState, setQueryState],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
}))

// The child: surface both exits as buttons so the test can fire either one.
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
    default: () => null,
}))
jest.mock('@/components/Global/PeanutLoading/CyclingLoading', () => ({ __esModule: true, default: () => null }))
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
jest.mock('@/utils/provider-rejection.utils', () => ({ deriveProviderRejection: () => ({ state: 'none' }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// imported after the jest.mock calls above, which must be hoisted first
import MantecaAddMoney from '../MantecaAddMoney'

const renderFlow = () =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MantecaAddMoney />
        </QueryClientProvider>
    )

// Drive the real handleAmountSubmit so `depositDetails` is populated the way it is in
// production — the showQR step renders `null` without it.
const reachQrStep = async () => {
    fireEvent.click(screen.getByText('submit-amount'))
    await waitFor(() => expect(screen.getByText('child-done')).toBeInTheDocument())
}

beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(queryState).forEach((k) => delete queryState[k])
    Object.assign(queryState, { amount: '250', currency: 'BRL' })
    mockDeposit.mockResolvedValue({ data: { id: 'syn-1', details: {}, stages: {} } })
})

describe('MantecaAddMoney — BRL/PIX exits', () => {
    // The bug: Done was wired to the same handler as back, so a settled deposit sent
    // the user to the amount input — i.e. into a new deposit — instead of out of the flow.
    it('sends the user home when the PIX screen signals it is done', async () => {
        renderFlow()
        await reachQrStep()

        fireEvent.click(screen.getByText('child-done'))

        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        // and specifically NOT back into the flow
        expect(setQueryState).not.toHaveBeenCalledWith({ step: 'inputAmount' })
    })

    it('returns to the amount step on back — the non-terminal exit is unchanged', async () => {
        renderFlow()
        await reachQrStep()

        fireEvent.click(screen.getByText('child-back'))

        expect(setQueryState).toHaveBeenCalledWith({ step: 'inputAmount' })
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })
})
