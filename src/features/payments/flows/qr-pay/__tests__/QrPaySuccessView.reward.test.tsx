/**
 * The success view shows a payment's QR reward from the flow's neutral `paidReward`, so a payment on
 * the Pix pay routes (Avenia) gets the same hold-to-claim card as a Manteca payment (TASK-24947 M5).
 */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaidReward } from '../paidReward'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/qr-pay',
}))
jest.mock('@/hooks/useSafeBack', () => ({ useReturnTo: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'tester' } } }) }))
jest.mock('@/hooks/useCardMarkupRate', () => ({ useCardMarkupRate: () => ({ data: undefined }) }))
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        openTransactionDetails: jest.fn(),
        isTransactionSelected: () => false,
        closeTransactionDetails: jest.fn(),
    }),
}))
jest.mock('@/components/TransactionDetails/TransactionDetailsDrawer', () => ({ TransactionDetailsDrawer: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/InviteFriendsModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Common/PointsCard', () => ({
    __esModule: true,
    default: ({ points }: { points: number }) => <div>points {points}</div>,
}))
jest.mock('../useQrReceipt', () => ({ useQrReceipt: () => ({ id: 'fixture-qr-avenia' }) }))

let mockPaidReward: PaidReward | null = null
jest.mock('../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        paidReward: mockPaidReward,
        markRewardClaimed: jest.fn(),
        paymentProcessor: 'PIX_PAY',
        currency: { code: 'BRL', symbol: 'R$', price: 5.27 },
        usdAmount: '8.06',
        pointsData: { estimatedPoints: 4 },
        pointsDivRef: { current: null },
        pixKeyOwner: null,
        paidTo: 'PADARIA PAO DOURADO LTDA',
        paidLocalAmount: '42.50',
    }),
}))

import { QrPaySuccessView } from '../views/QrPaySuccessView'

const avenia = (perk: PaidReward['perk']): PaidReward => ({
    paymentId: 'fixture-qr-avenia',
    merchantName: 'PADARIA PAO DOURADO LTDA',
    perk,
})

test('an Avenia payment with a QR reward shows the hold-to-claim card, not the points', () => {
    mockPaidReward = avenia({
        eligible: true,
        discountPercentage: 0,
        claimed: false,
        amountSponsored: 1,
        payoutStatus: 'pending',
    })
    renderWithIntl(<QrPaySuccessView />)
    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument()
    expect(screen.queryByText('points 4')).not.toBeInTheDocument()
})

test('an Avenia payment without a reward shows its points, as a Manteca one does', () => {
    mockPaidReward = avenia(null)
    renderWithIntl(<QrPaySuccessView />)
    expect(screen.getByText('points 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument()
})
