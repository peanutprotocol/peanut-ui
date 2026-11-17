/** @jest-environment jsdom */
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: jest.fn() }) }))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: [] }) }))
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: () => ({ code: 'BRL', price: null, rateAndFee: null, quotesTypedAmount: false }),
}))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: () => <div>amount form</div>,
}))
// the code of a deposit already made: its returned and expired screens offer Start new deposit
jest.mock('@/features/pix/components/PixQrDeposit', () => ({
    PixQrDeposit: ({ onNewDeposit }: { onNewDeposit: () => void }) => (
        <button onClick={onNewDeposit}>Start new deposit</button>
    ),
}))
jest.mock('@/features/pix/components/PixSetup', () => ({ PixSetup: () => <div>pix setup</div> }))

import { PixDepositFlow } from '../components/PixDepositFlow'

const TERMS = { key: 'accept-tos:avenia', url: 'https://app.avenia.io/Avenia-TC.pdf' }
const route = (overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
    ...overrides,
})
const client = new QueryClient()
const tree = (r: CapabilityRoute) => (
    <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams="?step=showQR&intentId=d1">
            <PixDepositFlow route={r} />
        </NuqsTestingAdapter>
    </QueryClientProvider>
)

// TASK-25073, Chip on 8a82b4711: terms that arrive while a deposit code is on screen
describe("Avenia's terms during a Pix deposit", () => {
    it('keep the code of the deposit made, and gate the new deposit Start new deposit opens', async () => {
        const view = renderWithIntl(tree(route()))
        expect(screen.getByRole('button', { name: 'Start new deposit' })).toBeInTheDocument()

        // a capabilities read brings the terms: the code of the deposit made stays
        view.rerender(tree(route({ terms: TERMS })))
        expect(screen.getByRole('button', { name: 'Start new deposit' })).toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Start new deposit' }))
        })
        expect(await screen.findByText('pix setup')).toBeInTheDocument()
        expect(screen.queryByText('amount form')).toBeNull()
    })
})
