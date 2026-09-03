/**
 * WithdrawMethodView — the method-select step that mutates the withdraw
 * flow's shared destination state (Chip review round 7). Pins what the
 * deleted AddWithdrawRouterView test used to cover:
 *  (a) a saved Manteca account forwards destination=<identifier> and
 *      isSavedAccount=true into /withdraw/manteca (skipping the shared
 *      amount step);
 *  (b) a saved non-Manteca account sets selectedBankAccount and advances to
 *      the amount step WITHOUT navigating;
 *  (c) the crypto row sets selectedMethod and performs no router.push — a
 *      pre-amount push trips the crypto page's no-amount redirect guard,
 *      whose unmount cleanup resets the flow.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { type Account } from '@/interfaces/interfaces'

// ---------- module-level mocks ----------

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/withdraw',
}))

jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), init: jest.fn() },
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { WITHDRAW_METHOD_SELECTED: 'withdraw_method_selected' },
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: { onClick?: () => void; children?: React.ReactNode }) => (
        <button onClick={props.onClick}>{props.children}</button>
    ),
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))

// SavedAccountsView: expose the callbacks the view wires up
jest.mock('@/components/Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: {
        savedAccounts: Account[]
        onAccountClick: (account: Account, path?: string) => void
        onCryptoClick: () => void
    }) => (
        <div>
            {props.savedAccounts.map((account) => (
                <button
                    key={account.identifier}
                    data-testid={`account-${account.identifier}`}
                    onClick={() => props.onAccountClick(account)}
                >
                    {account.identifier}
                </button>
            ))}
            <button data-testid="crypto-row" onClick={props.onCryptoClick}>
                Crypto
            </button>
        </div>
    ),
}))
jest.mock('@/components/Common/CountryList', () => ({ CountryList: () => null }))

jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [], isLoading: false }),
}))
jest.mock('@/hooks/useSendFlowOrigin', () => ({
    useSendFlowOrigin: () => ({ isBankFromSend: false }),
}))
jest.mock('@/utils/general.utils', () => ({
    getFromLocalStorage: () => null,
}))
jest.mock('@/utils/native-routes', () => ({
    withdrawCountryUrl: (path: string) => `/withdraw/${path}`,
}))

const MANTECA_ACCOUNT = {
    type: 'manteca',
    identifier: 'cbu-12345678901234567890',
    details: { countryName: 'argentina' },
} as unknown as Account
const IBAN_ACCOUNT = {
    type: 'iban',
    identifier: 'DE89370400440532013000',
    details: { countryName: 'germany' },
} as unknown as Account

jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({
        user: {
            accounts: [
                { type: 'manteca', identifier: 'cbu-12345678901234567890', details: { countryName: 'argentina' } },
                { type: 'iban', identifier: 'DE89370400440532013000', details: { countryName: 'germany' } },
            ],
        },
    }),
}))

const mockSetSelectedBankAccount = jest.fn()
const mockSetSelectedMethod = jest.fn()
jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({
        setSelectedBankAccount: mockSetSelectedBankAccount,
        setSelectedMethod: mockSetSelectedMethod,
    }),
}))

import { WithdrawMethodView } from '../WithdrawMethodView'

// ---------- helpers ----------

const mockOnExit = jest.fn()
const mockOnMethodChosen = jest.fn()

const renderView = (searchParams: Record<string, string> = {}) =>
    render(
        <NuqsTestingAdapter searchParams={searchParams}>
            <WithdrawMethodView
                pageTitle="Withdraw"
                mainHeading="Where to?"
                onExit={mockOnExit}
                onMethodChosen={mockOnMethodChosen}
            />
        </NuqsTestingAdapter>
    )

beforeEach(() => {
    jest.clearAllMocks()
})

// ---------- tests ----------

describe('WithdrawMethodView — destination state and routing (Chip review round 7)', () => {
    it('a saved Manteca account forwards destination + isSavedAccount into /withdraw/manteca', () => {
        renderView()
        fireEvent.click(screen.getByTestId(`account-${MANTECA_ACCOUNT.identifier}`))

        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(
            expect.objectContaining({ identifier: MANTECA_ACCOUNT.identifier })
        )
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'manteca', countryPath: 'argentina' })
        )
        const pushed = mockRouterPush.mock.calls.at(-1)?.[0] as string
        expect(pushed).toContain('/withdraw/manteca?')
        expect(pushed).toContain('country=argentina')
        expect(pushed).toContain(`destination=${MANTECA_ACCOUNT.identifier}`)
        expect(pushed).toContain('isSavedAccount=true')
        // Manteca collects its amount locally — the shared amount step is skipped
        expect(mockOnMethodChosen).not.toHaveBeenCalled()
    })

    it('a saved non-Manteca account sets the flow state and advances WITHOUT navigating', () => {
        renderView()
        fireEvent.click(screen.getByTestId(`account-${IBAN_ACCOUNT.identifier}`))

        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(
            expect.objectContaining({ identifier: IBAN_ACCOUNT.identifier })
        )
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'bridge', countryPath: 'germany' })
        )
        expect(mockOnMethodChosen).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('the crypto row sets the method in context and does NOT navigate', () => {
        // a pre-amount push trips the crypto page's no-amount redirect guard,
        // whose unmount cleanup resets the flow (the deleted
        // AddWithdrawRouterView test pinned this exact regression)
        renderView()
        fireEvent.click(screen.getByTestId('crypto-row'))

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(expect.objectContaining({ type: 'crypto' }))
        expect(mockOnMethodChosen).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
    })
})
