/**
 * QrPaySuccessView — the follow-up CTAs after a QR payment. A double tap on
 * "Split this bill" must navigate once, not push /request twice.
 */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

const mockPush = jest.fn()
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
import posthog from 'posthog-js'
const mockCapture = posthog.capture as jest.Mock
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/qr-pay',
}))
jest.mock('@/hooks/useSafeBack', () => ({ useReturnTo: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'tester' } } }) }))
jest.mock('@/hooks/useCardMarkupRate', () => ({ useCardMarkupRate: () => ({ data: undefined }) }))
const mockOpenTransactionDetails = jest.fn()
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        openTransactionDetails: mockOpenTransactionDetails,
        isTransactionSelected: () => false,
        closeTransactionDetails: jest.fn(),
    }),
}))
jest.mock('@/components/TransactionDetails/TransactionDetailsDrawer', () => ({ TransactionDetailsDrawer: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/InviteFriendsModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Common/PointsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('../usePerkHoldToClaim', () => ({
    usePerkHoldToClaim: () => ({
        rewardOffered: false,
        perkClaimed: false,
        holdProgress: 0,
        isShaking: false,
        shakeIntensity: 0,
        startHold: jest.fn(),
        cancelHold: jest.fn(),
    }),
}))
const receipt = { id: 'qp1' }
jest.mock('../useQrReceipt', () => ({ useQrReceipt: () => receipt }))
jest.mock('../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        qrPayment: {
            id: 'qp1',
            status: 'COMPLETED',
            details: { merchant: { name: 'Shop' }, paymentAssetAmount: '1000' },
        },
        setQrPayment: jest.fn(),
        paymentLock: null,
        currency: { code: 'ARS', symbol: 'ARS', price: 1000 },
        usdAmount: '1',
        pointsData: null,
        pointsDivRef: { current: null },
        pixKeyOwner: null,
    }),
}))

import { QrPaySuccessView } from '../views/QrPaySuccessView'

beforeEach(() => jest.clearAllMocks())

test('a double tap on Split this bill navigates once', () => {
    renderWithIntl(<QrPaySuccessView />)
    const split = screen.getByRole('button', { name: /split this bill/i })
    fireEvent.click(split)
    fireEvent.click(split)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/request?amount=1&merchant=Shop')
})

test('Split this bill records one receipt action tap from the success screen (TASK-24141)', () => {
    renderWithIntl(<QrPaySuccessView />)
    const split = screen.getByRole('button', { name: /split this bill/i })
    fireEvent.click(split)
    fireEvent.click(split)
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith('receipt_action_tapped', {
        action: 'split',
        placement: 'qr_success',
        kind: 'QR_PAY',
    })
})

test('See receipt opens the receipt built for this payment', () => {
    renderWithIntl(<QrPaySuccessView />)
    const seeReceipt = screen.getByRole('button', { name: /see receipt/i })
    expect(seeReceipt).toBeEnabled()
    fireEvent.click(seeReceipt)
    expect(mockOpenTransactionDetails).toHaveBeenCalledWith(receipt)
})
