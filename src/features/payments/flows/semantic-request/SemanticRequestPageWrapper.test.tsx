import { render, screen, waitFor } from '@testing-library/react'
import { SemanticRequestPageWrapper } from './SemanticRequestPageWrapper'

const mockReplace = jest.fn()
const mockPaymentPage = jest.fn()
let mockSearchParams = new URLSearchParams()
const mockRouter = { replace: mockReplace }
const mockT = (key: string) => key
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams, useRouter: () => mockRouter }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => mockT }))
jest.mock('@/lib/url-parser/parser', () => ({ parsePaymentURL: jest.fn() }))
const mockGetCharge = jest.fn()
jest.mock('@/services/charges', () => ({ chargesApi: { get: (id: string) => mockGetCharge(id) } }))
jest.mock('@/components/Global/Loading', () => () => null)
jest.mock('@/components/Global/EmptyStates/EmptyState', () => () => null)
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('./SemanticRequestPage', () => ({
    SemanticRequestPage: (props: unknown) => {
        mockPaymentPage(props)
        return <div>Payment flow</div>
    },
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockGetCharge.mockResolvedValue({ fulfillmentPayment: null })
})

it.each(['chargeId=unpaid-admission&context=card-pioneer', 'context=card-pioneer'])(
    'redirects a retired admission link before mounting the payment flow: %s',
    async (query) => {
        mockSearchParams = new URLSearchParams(query)
        render(<SemanticRequestPageWrapper recipient={[]} />)
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/card'))
        expect(mockPaymentPage).not.toHaveBeenCalled()
        expect(screen.queryByText('Payment flow')).not.toBeInTheDocument()
    }
)

it('keeps a COMPLETED admission charge reachable as a receipt', async () => {
    mockSearchParams = new URLSearchParams('chargeId=paid-admission&context=card-pioneer')
    mockGetCharge.mockResolvedValue({ fulfillmentPayment: { status: 'SUCCESSFUL' } })
    render(<SemanticRequestPageWrapper recipient={[]} />)
    expect(await screen.findByText('Payment flow')).toBeInTheDocument()
    expect(mockGetCharge).toHaveBeenCalledWith('paid-admission')
    expect(mockPaymentPage).toHaveBeenCalledWith(expect.objectContaining({ initialChargeId: 'paid-admission' }))
    expect(mockReplace).not.toHaveBeenCalled()
})

it('redirects an admission charge that cannot be resolved', async () => {
    mockSearchParams = new URLSearchParams('chargeId=gone-admission&context=card-pioneer')
    mockGetCharge.mockRejectedValue(new Error('not found'))
    render(<SemanticRequestPageWrapper recipient={[]} />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/card'))
    expect(mockPaymentPage).not.toHaveBeenCalled()
})

it('keeps normal charge payment links payable', async () => {
    mockSearchParams = new URLSearchParams('chargeId=normal-charge&context=invoice')
    render(<SemanticRequestPageWrapper recipient={[]} />)
    expect(await screen.findByText('Payment flow')).toBeInTheDocument()
    expect(mockPaymentPage).toHaveBeenCalledWith(expect.objectContaining({ initialChargeId: 'normal-charge' }))
    expect(mockReplace).not.toHaveBeenCalled()
})
