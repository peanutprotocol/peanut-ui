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
jest.mock('@/components/Global/PeanutLoading', () => () => null)
jest.mock('@/components/Global/ErrorAlert', () => () => null)
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

it('keeps normal charge payment links payable', async () => {
    mockSearchParams = new URLSearchParams('chargeId=normal-charge&context=invoice')
    render(<SemanticRequestPageWrapper recipient={[]} />)
    expect(await screen.findByText('Payment flow')).toBeInTheDocument()
    expect(mockPaymentPage).toHaveBeenCalledWith(expect.objectContaining({ initialChargeId: 'normal-charge' }))
    expect(mockReplace).not.toHaveBeenCalled()
})
