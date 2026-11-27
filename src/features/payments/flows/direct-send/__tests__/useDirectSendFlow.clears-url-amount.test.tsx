import { act, renderHook, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import type { Address } from 'viem'
import { IntlWrapper } from '@/test-utils/intl'
import { DirectSendFlowProvider, type DirectSendRecipient } from '../DirectSendFlowContext'
import { useDirectSendFlow } from '../useDirectSendFlow'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: async () => ({ uuid: 'charge-1' }), isCreating: false }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: async () => ({ uuid: 'p1' }), isRecording: false }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentStatusRecovery', () => ({
    usePaymentStatusRecovery: () => jest.fn(),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: async () => ({ txHash: '0xsent' }),
        formattedSpendableBalance: '100',
        spendableBalanceDecimal: 100,
        hasSufficientSpendableBalance: () => true,
        isFetchingSpendableBalance: false,
        availableSpendableBalance: 100_000_000n,
        isSpendableBalanceReady: true,
    }),
}))

const recipient = {
    username: 'ana',
    address: '0x1111111111111111111111111111111111111111' as Address,
} as DirectSendRecipient

// Chip on ui#4316: the amount rides in the URL for the add-money round trip, so a sent payment
// must drop it, or a refresh opens Send filled in again
it('a successful payment clears the amount from the URL and keeps it on the receipt', async () => {
    const updates: UrlUpdateEvent[] = []
    const Nuqs = withNuqsTestingAdapter({ searchParams: '?amount=10', onUrlUpdate: (e) => updates.push(e) })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <IntlWrapper>
            <Nuqs>
                <DirectSendFlowProvider initialRecipient={recipient}>{children}</DirectSendFlowProvider>
            </Nuqs>
        </IntlWrapper>
    )
    const { result } = renderHook(() => useDirectSendFlow(), { wrapper })
    expect(result.current.amount).toBe('10')

    await act(() => result.current.executePayment())

    expect(result.current.currentView).toBe('STATUS')
    await waitFor(() => expect(updates.at(-1)?.searchParams.has('amount')).toBe(false))
    expect(result.current.usdAmount).toBe('10')
})
