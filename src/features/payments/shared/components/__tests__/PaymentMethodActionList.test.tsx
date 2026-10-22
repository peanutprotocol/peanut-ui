/**
 * PaymentMethodActionList — which methods render
 *
 * Regression: the direct-send flow rendered the "Crypto" card
 * without an onPayWithExternalWallet handler, so it was enabled but its tap was
 * a silent no-op (dead button). The card must only render when the caller can
 * honor it (i.e. provides the handler — the semantic-request flow does).
 *
 * Regression (TASK-23974): a signed-in user on the payment-request page got the
 * guest funding methods (bank, Mercado Pago, Pix), which push to /setup — a
 * signup that user has already completed. They are for guests only.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
}))

// Return a fixed method list so the filter is the only thing under test.
const METHODS = [
    { id: 'bank', title: 'Bank transfer', description: 'd', icons: [], soon: false },
    { id: 'mercadopago', title: 'Mercado Pago', description: 'd', icons: [], soon: false },
    { id: 'pix', title: 'Pix', description: 'd', icons: [], soon: false },
    { id: 'exchange-or-wallet', title: 'Crypto', description: 'd', icons: [], soon: false },
]
const GUEST_METHOD_TITLES = ['Bank transfer', 'Mercado Pago', 'Pix']
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: METHODS, isLoading: false }),
}))

const signedIn = { user: { user: { userId: 'me' } }, isFetchingUser: false }
const signedOut = { user: null, isFetchingUser: false }
let mockAuth: { user: unknown; isFetchingUser: boolean } = signedOut
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ canDo: () => true, bankRails: () => [] }),
}))

jest.mock('@/utils/general.utils', () => ({ saveRedirectUrl: jest.fn() }))

jest.mock('@/components/0_Bruddle/Divider', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/IconStack', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Badges/Badge', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/0_Bruddle/ListItem', () => ({
    ListItem: (props: { title: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
        <button onClick={props.onClick} disabled={props.disabled}>
            {props.title}
        </button>
    ),
}))

import { PaymentMethodActionList } from '../PaymentMethodActionList'

beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = signedOut
})

describe('PaymentMethodActionList — Crypto card', () => {
    it('is hidden when no onPayWithExternalWallet handler is provided (direct-send)', () => {
        render(<PaymentMethodActionList isAmountEntered={true} />)
        expect(screen.queryByText('Crypto')).not.toBeInTheDocument()
        // other methods still render
        expect(screen.getByText('Bank transfer')).toBeInTheDocument()
    })

    it('is shown and invokes the handler when onPayWithExternalWallet is provided (semantic-request)', () => {
        const onPay = jest.fn()
        render(<PaymentMethodActionList isAmountEntered={true} onPayWithExternalWallet={onPay} />)
        const card = screen.getByText('Crypto')
        expect(card).toBeInTheDocument()
        fireEvent.click(card)
        expect(onPay).toHaveBeenCalledTimes(1)
        // the external-wallet handler short-circuits — no /setup redirect
        expect(mockRouterPush).not.toHaveBeenCalled()
    })
})

describe('PaymentMethodActionList — guest funding methods', () => {
    it('shows every method to a guest, and Bank sends them through signup to add-money', () => {
        render(<PaymentMethodActionList isAmountEntered={true} onPayWithExternalWallet={jest.fn()} />)
        for (const title of [...GUEST_METHOD_TITLES, 'Crypto']) {
            expect(screen.getByText(title)).toBeInTheDocument()
        }
        fireEvent.click(screen.getByText('Bank transfer'))
        expect(mockRouterPush).toHaveBeenCalledWith('/setup?redirect_uri=%2Fadd-money')
    })

    it('hides them from a signed-in user and keeps a working Crypto card', () => {
        mockAuth = signedIn
        const onPay = jest.fn()
        render(<PaymentMethodActionList isAmountEntered={true} onPayWithExternalWallet={onPay} />)
        for (const title of GUEST_METHOD_TITLES) {
            expect(screen.queryByText(title)).not.toBeInTheDocument()
        }
        fireEvent.click(screen.getByText('Crypto'))
        expect(onPay).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('hides them while the session is still loading', () => {
        mockAuth = { user: null, isFetchingUser: true }
        render(<PaymentMethodActionList isAmountEntered={true} onPayWithExternalWallet={jest.fn()} />)
        for (const title of GUEST_METHOD_TITLES) {
            expect(screen.queryByText(title)).not.toBeInTheDocument()
        }
        expect(screen.getByText('Crypto')).toBeInTheDocument()
    })

    it('renders nothing for a signed-in user when there is no external-wallet handler', () => {
        mockAuth = signedIn
        const { container } = render(<PaymentMethodActionList isAmountEntered={true} />)
        expect(container).toBeEmptyDOMElement()
    })
})
