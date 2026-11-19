import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { RequestCreatedView } from '../RequestCreatedView'

jest.mock('@/utils/confetti', () => ({ shootDoubleStarConfetti: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="mascot" />,
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr-code">{url}</div>,
}))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ url, children }: { url: string; children: React.ReactNode }) => (
        <button data-url={url}>{children}</button>
    ),
}))
jest.mock('../RequestFulfillmentNotice', () => ({ RequestFulfillmentNotice: () => null }))
jest.mock('@/features/deposit-accounts/components/RequestBankTransferCard', () => ({
    RequestBankTransferCard: ({ requestId, canShare }: { requestId: string; canShare?: boolean }) => (
        <div data-testid="bank-transfer-card" data-request={requestId} data-share={String(!!canShare)} />
    ),
}))

const renderView = (overrides: Partial<React.ComponentProps<typeof RequestCreatedView>> = {}) => {
    const props = {
        requestId: 'request-1',
        generatedLink: 'https://peanut.me/request/pay?id=request-1',
        requestAmount: '25',
        currency: 'EUR',
        bankPayable: true,
        onDone: jest.fn(),
        ...overrides,
    }

    render(
        <StrictMode>
            <NextIntlClientProvider locale="en" messages={messages}>
                <RequestCreatedView {...props} />
            </NextIntlClientProvider>
        </StrictMode>
    )
    return props
}

it('makes successful creation persistent and celebrates once', () => {
    renderView()

    expect(screen.getByRole('heading', { name: messages.request.created.title })).toBeInTheDocument()
    expect(screen.getByTestId('qr-code')).toHaveTextContent('https://peanut.me/request/pay?id=request-1')
    expect(screen.getByRole('button', { name: 'Share 25 EUR request' })).toHaveAttribute(
        'data-url',
        'https://peanut.me/request/pay?id=request-1'
    )
    expect(shootDoubleStarConfetti).toHaveBeenCalledTimes(1)
})

it('shows two buttons, primary Done first, then share', () => {
    renderView({ requestAmount: '', bankPayable: false })

    expect(screen.queryByTestId('bank-transfer-card')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
        messages.common.done,
        messages.request.shareOpenRequest,
    ])
})

it('exits the terminal state through Done', () => {
    const props = renderView()

    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: messages.common.done }))
    expect(props.onDone).toHaveBeenCalledTimes(1)
})

// What a payer is told to pay by bank, before the requester shares the link.
it('shows the shareable bank transfer card for a request that accepts bank transfer', () => {
    renderView()

    const card = screen.getByTestId('bank-transfer-card')
    expect(card).toHaveAttribute('data-request', 'request-1')
    expect(card).toHaveAttribute('data-share', 'true')
})
