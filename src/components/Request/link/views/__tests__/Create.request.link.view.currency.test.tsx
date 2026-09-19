/**
 * CreateRequestLinkView — how the screen presents a request asked in another
 * currency than dollars. The hook is mocked: its own suite covers the state.
 */
import { IntlWrapper } from '@/test-utils/intl'
import { render, screen } from '@testing-library/react'

jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))
jest.mock('@/components/Request/useRequestBack', () => ({ useRequestBack: () => jest.fn() }))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({ useDepositAccountsEnabled: () => false }))
jest.mock('../RequestFulfillmentNotice', () => ({ RequestFulfillmentNotice: () => null }))

const mockAmountInput = jest.fn()
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockAmountInput(props)
        return null
    },
}))

let mockHook: Record<string, unknown>
jest.mock('../useCreateRequestLink', () => ({ useCreateRequestLink: () => mockHook }))

import { CreateRequestLinkView } from '../Create.request.link.view'

const hookState = (overrides: Record<string, unknown> = {}) => ({
    requestAmount: '',
    currency: 'USD',
    accountCurrencies: [],
    exchangeRate: 0,
    attachmentOptions: { message: '', fileUrl: '', rawFile: undefined },
    errorState: { showError: false, errorMessage: '' },
    generatedLink: null,
    requestId: null,
    isCreatingLink: false,
    isUpdatingRequest: false,
    qrCodeLink: 'https://peanut.me/send/kush',
    bankInstructionsShared: false,
    setBankInstructionsShared: jest.fn(),
    handleRequestAmountChange: jest.fn(),
    handleCurrencyChange: jest.fn(),
    handleAttachmentOptionsChange: jest.fn(),
    handleTokenAmountSubmit: jest.fn(),
    generateLink: jest.fn(),
    ...overrides,
})

const renderView = (overrides?: Record<string, unknown>) => {
    mockHook = hookState(overrides)
    return render(<CreateRequestLinkView />, { wrapper: IntlWrapper })
}
const amountInputProps = () => mockAmountInput.mock.calls.at(-1)![0]

beforeEach(() => jest.clearAllMocks())

describe('CreateRequestLinkView — request currency', () => {
    it('asks in dollars by default, with the plain dollar amount input', () => {
        renderView({ requestAmount: '25' })

        expect(screen.getByRole('button', { name: 'Request currency: USD' })).toBeInTheDocument()
        expect(amountInputProps().initialAmount).toBe('25')
        expect(amountInputProps().primaryDenomination).toBeUndefined()
        expect(amountInputProps().secondaryDenomination).toBeUndefined()
    })

    // The requester types euros and reads the dollar side underneath.
    it('types in the request currency and shows the dollar equivalent as the secondary line', () => {
        renderView({ currency: 'EUR', requestAmount: '100', exchangeRate: 0.8 })

        expect(amountInputProps().primaryDenomination).toEqual({ symbol: 'EUR', price: 0.8, decimals: 2 })
        expect(amountInputProps().secondaryDenomination).toEqual({ symbol: 'USD', price: 1, decimals: 2 })
    })

    // A conversion line with no rate behind it would show a wrong number.
    it('shows the amount alone while there is no rate', () => {
        renderView({ currency: 'EUR', requestAmount: '100', exchangeRate: 0 })

        expect(amountInputProps().primaryDenomination.symbol).toBe('EUR')
        expect(amountInputProps().secondaryDenomination).toBeUndefined()
    })

    it('locks the currency once the request exists, and names it on the share button', () => {
        renderView({
            currency: 'EUR',
            requestAmount: '100',
            exchangeRate: 0.8,
            requestId: 'req-1',
            generatedLink: 'https://peanut.me/request/pay?id=req-1',
        })

        expect(screen.getByRole('button', { name: 'Request currency: EUR' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Share 100 EUR request' })).toBeInTheDocument()
        // `disabled` leaves the swap button live, so the toggle goes too
        expect(amountInputProps()).toEqual(expect.objectContaining({ disabled: true, hideCurrencyToggle: true }))
    })

    it('keeps the currency swap while the request is still being written', () => {
        renderView({ currency: 'EUR', requestAmount: '100', exchangeRate: 0.8 })

        expect(amountInputProps().hideCurrencyToggle).toBe(false)
    })

    it('keeps the dollar share label for a dollar request', () => {
        renderView({ requestAmount: '25', requestId: 'req-1', generatedLink: 'https://peanut.me/request/pay?id=req-1' })

        expect(screen.getByRole('button', { name: 'Share $25 request' })).toBeInTheDocument()
    })
})
