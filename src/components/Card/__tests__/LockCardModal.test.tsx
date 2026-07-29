/**
 * Regression tests for the lock/cancel collateral withdrawal (prod incident
 * 2026-07-24): both modals MUST force collateral-only routing when returning
 * spending power. Without `forceStrategy`, live routing picks smart-only
 * whenever the smart wallet covers the amount (spendPreflight), and the
 * modals then reject their own artifact ("Unexpected withdrawal strategy"),
 * so users with wallet balance ≥ card balance could neither lock nor cancel.
 *
 * Contracts locked down here, for BOTH modals:
 *  1. spendingPower > 0 → signSpend is called WITH forceStrategy:
 *     'collateral-only' (the assertion that catches the regression) and the
 *     signed withdrawal is delivered to the backend call,
 *  2. an unloaded overview fails closed BEFORE signing — undefined reads as
 *     zero spending power, which would silently skip the withdrawal and get
 *     the action rejected server-side,
 *  3. a loaded overview with zero spending power proceeds without signing
 *     (no passkey prompt when there is nothing to return).
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import LockCardModal from '@/components/Card/LockCardModal'
import CancelCardModal from '@/components/Card/CancelCardModal'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { rainApi } from '@/services/rain'

const WALLET = '0xafbea1a6a6036d7d827e08072cd4315248b77352'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: jest.fn() }))
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: jest.fn() }))
jest.mock('@/services/rain', () => ({
    rainApi: {
        lockCard: jest.fn(),
        activateCard: jest.fn(),
        cancelCard: jest.fn(),
        submitCancellationFeedback: jest.fn(),
    },
}))
// Modal chrome and the slide gesture are not under test — render passthroughs.
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))
jest.mock('@/components/Card/SlideToAction', () => ({
    __esModule: true,
    default: ({ label, onComplete, disabled }: { label: string; onComplete: () => void; disabled?: boolean }) => (
        <button onClick={onComplete} disabled={disabled}>
            {label}
        </button>
    ),
}))

const mockOverview = useRainCardOverview as jest.Mock
const mockUseWallet = useWallet as jest.Mock
const mockUseSignSpendBundle = useSignSpendBundle as jest.Mock
const mockLockCard = rainApi.lockCard as jest.Mock
const mockCancelCard = rainApi.cancelCard as jest.Mock
const mockSignSpend = jest.fn()

const RAIN_WITHDRAWAL = { preparationId: 'prep-1', amount: '10060000' }
// $10.06 spending power — the reporting user's exact state.
const OVERVIEW = { balance: { spendingPower: 1006 } }
const FORCED_SIGN_ARGS = {
    requiredUsdcAmount: 10_060_000n, // 1006 cents → 6dp USDC units
    recipient: WALLET,
    rainSpendingPower: 10_060_000n,
    kind: 'CRYPTO_WITHDRAW',
    forceStrategy: 'collateral-only',
}

// Real `en.json`, not a key-echoing stub: the assertions below match on the
// user-visible strings ("Slide to Lock", "Card locked"), so the messages have to
// be the published ones. Both modals call useTranslations('card').
const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {children}
        </QueryClientProvider>
    </NextIntlClientProvider>
)

const setup = (overview?: { balance: { spendingPower: number } }) => {
    mockOverview.mockReturnValue({ overview })
    mockUseWallet.mockReturnValue({ address: WALLET })
    mockUseSignSpendBundle.mockReturnValue({ signSpend: mockSignSpend })
}

const renderLock = () =>
    render(<LockCardModal cardId="card-1" mode="lock" isOpen onClose={jest.fn()} />, { wrapper: Wrapper })
const renderCancel = () => render(<CancelCardModal cardId="card-1" isOpen onClose={jest.fn()} />, { wrapper: Wrapper })

beforeEach(() => {
    jest.clearAllMocks()
    mockSignSpend.mockResolvedValue({ strategy: 'collateral-only', rainWithdrawal: RAIN_WITHDRAWAL })
    mockLockCard.mockResolvedValue({})
    mockCancelCard.mockResolvedValue({})
})

describe('LockCardModal — lock with spending power', () => {
    it('forces collateral-only routing and delivers the withdrawal to the lock call', async () => {
        setup(OVERVIEW)
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText('Card locked')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockLockCard).toHaveBeenCalledWith('card-1', RAIN_WITHDRAWAL)
    })

    it('fails closed before signing when the overview has not loaded', async () => {
        setup(undefined)
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText(/still loading/)).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockLockCard).not.toHaveBeenCalled()
    })

    it('locks without signing when there is no spending power to return', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText('Card locked')).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockLockCard).toHaveBeenCalledWith('card-1', undefined)
    })
})

describe('CancelCardModal', () => {
    it('forces collateral-only routing and delivers the withdrawal to the cancel call', async () => {
        setup(OVERVIEW)
        renderCancel()
        fireEvent.click(screen.getByText('Slide to Cancel'))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockCancelCard).toHaveBeenCalledWith('card-1', { verifiedWithdrawal: RAIN_WITHDRAWAL })
    })

    it('fails closed before signing when the overview has not loaded', async () => {
        setup(undefined)
        renderCancel()
        fireEvent.click(screen.getByText('Slide to Cancel'))
        expect(await screen.findByText(/still loading/)).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockCancelCard).not.toHaveBeenCalled()
    })

    it('cancels without signing when there is no spending power to return', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderCancel()
        fireEvent.click(screen.getByText('Slide to Cancel'))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockCancelCard).toHaveBeenCalledWith('card-1', { verifiedWithdrawal: undefined })
    })
})
