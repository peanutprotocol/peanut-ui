/**
 * PaymentMethodActionList — "Exchange or Wallet" visibility
 *
 * Regression: the direct-send flow rendered the "Exchange or Wallet" card
 * without an onPayWithExternalWallet handler, so it was enabled but its tap was
 * a silent no-op (dead button). The card must only render when the caller can
 * honor it (i.e. provides the handler — the semantic-request flow does).
 */
import React, { type ReactNode } from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'

const IntlWrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
}))

// Return a fixed method list so the filter is the only thing under test.
const METHODS = [
    { id: 'bank', title: 'Bank', description: 'd', icons: [], soon: false },
    { id: 'exchange-or-wallet', title: 'Exchange or Wallet', description: 'd', icons: [], soon: false },
]
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: METHODS, isLoading: false }),
}))

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ canDo: () => true, bankRails: () => [] }),
}))

jest.mock('@/utils/general.utils', () => ({ saveRedirectUrl: jest.fn() }))

jest.mock('@/components/0_Bruddle/Divider', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/IconStack', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Badges/StatusBadge', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/ActionListCard', () => ({
    ActionListCard: (props: { title: React.ReactNode; onClick: () => void; isDisabled?: boolean }) => (
        <button onClick={props.onClick} disabled={props.isDisabled}>
            {props.title}
        </button>
    ),
}))

import { PaymentMethodActionList } from '../PaymentMethodActionList'

beforeEach(() => jest.clearAllMocks())

describe('PaymentMethodActionList — Exchange or Wallet card', () => {
    it('is hidden when no onPayWithExternalWallet handler is provided (direct-send)', () => {
        render(<PaymentMethodActionList isAmountEntered={true} />)
        expect(screen.queryByText('Exchange or Wallet')).not.toBeInTheDocument()
        // other methods still render
        expect(screen.getByText('Bank')).toBeInTheDocument()
    })

    it('is shown and invokes the handler when onPayWithExternalWallet is provided (semantic-request)', () => {
        const onPay = jest.fn()
        render(<PaymentMethodActionList isAmountEntered={true} onPayWithExternalWallet={onPay} />)
        const card = screen.getByText('Exchange or Wallet')
        expect(card).toBeInTheDocument()
        fireEvent.click(card)
        expect(onPay).toHaveBeenCalledTimes(1)
        // the external-wallet handler short-circuits — no /setup redirect
        expect(mockRouterPush).not.toHaveBeenCalled()
    })
})
