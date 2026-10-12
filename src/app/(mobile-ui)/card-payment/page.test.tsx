import { render } from '@testing-library/react'
import CardPaymentPage from './page'

const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    useSearchParams: () => mockSearchParams,
}))
jest.mock('@/components/Global/Loading', () => () => null)

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
})

it('forwards a legacy admission charge to the semantic surface, which owns the receipt decision', () => {
    mockSearchParams = new URLSearchParams('chargeId=paid-or-not')
    render(<CardPaymentPage />)
    expect(mockReplace).toHaveBeenCalledWith('/pay-request?chargeId=paid-or-not&context=card-pioneer')
})

it('opens the public application when there is no charge', () => {
    render(<CardPaymentPage />)
    expect(mockReplace).toHaveBeenCalledWith('/card')
})
