/**
 * LinkSendSuccessView — cancel on a link the recipient already claimed
 * (TASK-22091). The API answers 409 LINK_ALREADY_CLAIMED. The sender must see
 * the already-claimed copy (not "Failed to cancel"), the history query must be
 * refetched, and the view must leave for home without rendering a "Cancelled"
 * state for money that never came back.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TRANSACTIONS } from '@/constants/query.consts'

const mockPush = jest.fn()
const mockCancelLinkAndClaim = jest.fn()
const mockInvalidateQueries = jest.fn(async () => undefined)
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }
const mockCaptureException = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/LinkSendFlowContext', () => ({
    useLinkSendFlow: () => ({
        link: 'https://peanut.me/claim#p=pw',
        attachmentOptions: { message: '' },
        tokenValue: '10',
        resetLinkSendFlow: jest.fn(),
    }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ fetchBalance: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1' }, accounts: [{ type: 'peanut-wallet', identifier: '0xwallet' }] },
    }),
}))
jest.mock('@/components/Claim/useClaimLink', () => ({
    __esModule: true,
    default: () => ({
        cancelLinkAndClaim: mockCancelLinkAndClaim,
        pollForClaimConfirmation: jest.fn(async () => true),
    }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children?: React.ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({
    __esModule: true,
    default: ({ showCancelLinkDrawer, onClick }: { showCancelLinkDrawer: boolean; onClick: () => void }) =>
        showCancelLinkDrawer ? (
            <button data-testid="confirm-cancel" onClick={onClick}>
                confirm
            </button>
        ) : null,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/SuccessViewComponents/SuccessViewDetailsCard', () => ({
    SuccessViewDetailsCard: () => null,
}))

import LinkSendSuccessView from '../Success.link.send.view'

const alreadyClaimed = () =>
    Object.assign(new Error('This link was already claimed.'), { code: 'LINK_ALREADY_CLAIMED' })

const cancelFromView = async () => {
    render(<LinkSendSuccessView />)
    fireEvent.click(screen.getByText('link.cancelLink'))
    fireEvent.click(await screen.findByTestId('confirm-cancel'))
}

beforeEach(() => jest.clearAllMocks())

describe('LinkSendSuccessView — cancel on an already-claimed link', () => {
    test('shows the already-claimed copy, refetches history and leaves for home', async () => {
        mockCancelLinkAndClaim.mockRejectedValue(alreadyClaimed())

        await cancelFromView()

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
        expect(mockToast.info).toHaveBeenCalledWith('sendLinkAlreadyClaimed')
        expect(mockToast.error).not.toHaveBeenCalled()
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
        expect(mockCaptureException).not.toHaveBeenCalled()
        // no "Cancelled" copy for money that never came back
        expect(screen.queryByText('link.cancelled')).toBeNull()
    })

    test('a refetch failure after the 409 still leaves for home', async () => {
        mockCancelLinkAndClaim.mockRejectedValue(alreadyClaimed())
        mockInvalidateQueries.mockRejectedValueOnce(new Error('offline'))

        await cancelFromView()

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/home'))
        expect(mockToast.error).not.toHaveBeenCalled()
    })

    test('any other failure keeps the retry toast and stays on the screen', async () => {
        mockCancelLinkAndClaim.mockRejectedValue(new Error('paymaster down'))

        await cancelFromView()

        await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('link.cancelFailed'))
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })
})
