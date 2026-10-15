import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import type { RequestDepositInstructions } from '@/services/services.types'
import { IntlWrapper } from '@/test-utils/intl'
import type { ReactNode } from 'react'
import { RequestBankTransferCard } from '../components/RequestBankTransferCard'

const mockHook = jest.fn()
jest.mock('../useRequestDepositInstructions', () => ({
    useRequestDepositInstructions: (...args: unknown[]) => mockHook(...args),
}))
jest.mock('@/hooks/useExchangeRate', () => ({ useExchangeRate: () => ({ exchangeRate: 0 }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { fullName: 'Ana Silva' } } }) }))
const mockCopy = jest.fn(async (_text: string) => true)
jest.mock('@/utils/clipboard.utils', () => ({ copyTextToClipboard: (text: string) => mockCopy(text) }))

const INSTRUCTIONS = {
    paymentReference: 'demo-req',
    payerAmount: { amount: '46.10', currency: 'EUR', isEstimate: false },
    depositAccount: {
        country: 'DEU',
        currency: 'EUR',
        railId: 'bridge.sepa_eu',
        matching: { nameOnAccount: 'user', sender: 'anyone' },
        instructions: { accountHolderName: 'Ana Silva', iban: 'DE89370400440532013000', paymentRails: ['sepa'] },
    },
} as unknown as RequestDepositInstructions

const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <ToastProvider>{children}</ToastProvider>
    </IntlWrapper>
)

const loaded = () => mockHook.mockReturnValue({ instructions: INSTRUCTIONS, isLoading: false, isUnavailable: false })

beforeEach(() => jest.clearAllMocks())

describe('RequestBankTransferCard', () => {
    it('holds the two rows with a skeleton while the details load', () => {
        mockHook.mockReturnValue({ instructions: undefined, isLoading: true, isUnavailable: false })
        const { container } = render(<RequestBankTransferCard requestId="req-1" title="Bank transfer" />, { wrapper })
        expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
        expect(screen.getByText('Bank transfer')).toBeInTheDocument()
    })

    // A paid or closed request answers 404: no heading and no empty card.
    it('renders nothing when the details are unavailable', () => {
        mockHook.mockReturnValue({ instructions: null, isLoading: false, isUnavailable: true })
        render(<RequestBankTransferCard requestId="req-1" title="Bank transfer" />, { wrapper })
        expect(screen.queryByText('Bank transfer')).not.toBeInTheDocument()
        expect(screen.queryByText('Payment reference')).not.toBeInTheDocument()
    })

    it('reads the request it is given, always', () => {
        loaded()
        render(<RequestBankTransferCard requestId="req-1" />, { wrapper })
        expect(mockHook).toHaveBeenCalledWith('req-1', true)
    })

    it('shows the reference and the bank details row', () => {
        loaded()
        render(<RequestBankTransferCard requestId="req-1" />, { wrapper })
        expect(screen.getByText('Payment reference')).toBeInTheDocument()
        expect(screen.getByText('demo-req')).toBeInTheDocument()
        expect(screen.getByText('Bank details')).toBeInTheDocument()
        expect(screen.getByText('EUR · SEPA')).toBeInTheDocument()
        expect(screen.queryByText('DE89370400440532013000')).not.toBeInTheDocument()
    })

    it('opens the full details on a tap of the bank details row', async () => {
        loaded()
        const onOpenChange = jest.fn()
        render(<RequestBankTransferCard requestId="req-1" onOpenChange={onOpenChange} />, { wrapper })
        fireEvent.click(screen.getByRole('button', { name: /Bank details/ }))
        expect(await screen.findByText('Pay in EUR · SEPA')).toBeInTheDocument()
        expect(screen.getAllByText('DE89370400440532013000').length).toBeGreaterThan(0)
        expect(onOpenChange).toHaveBeenCalledWith(true)
        expect(screen.queryByText('Copy all details')).not.toBeInTheDocument()
    })

    it('shares the details with the amount and the reference', async () => {
        loaded()
        render(<RequestBankTransferCard requestId="req-1" canShare />, { wrapper })
        fireEvent.click(screen.getByRole('button', { name: /Bank details/ }))
        fireEvent.click(await screen.findByRole('button', { name: 'Copy all details' }))
        await waitFor(() => expect(mockCopy).toHaveBeenCalled())
        const text = mockCopy.mock.calls[0][0]
        expect(text).toContain('DE89370400440532013000')
        expect(text).toContain('Amount to send: €46.10')
        expect(text).toContain('Payment reference: demo-req')
        expect(text).toContain('Add the reference to every transfer.')
    })
})
