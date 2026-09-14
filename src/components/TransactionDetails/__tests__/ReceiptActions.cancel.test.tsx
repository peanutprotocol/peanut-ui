/**
 * ReceiptActions.handleCancelSendLink is the only consumer of cancelSendLink's
 * 'cancelled' | 'already-claimed' | 'failed' result and the surface that
 * decides what the sender is told about their money (TASK-22091):
 *  - already-claimed → close the receipt, never show "Cancelled"
 *  - failed          → stay open for a retry, label back to idle
 *  - cancelled       → "Cancelled" label, then close
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'

const mockCancelSendLink = jest.fn()

jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'sender' } } }) }))
jest.mock('@/hooks/useActivationStatus', () => ({ useActivationStatus: () => ({ isActivated: false }) }))
jest.mock('../useReceiptActions', () => ({
    useReceiptActions: () => ({
        closeRequest: jest.fn(),
        rejectRequest: jest.fn(),
        cancelSendLink: mockCancelSendLink,
    }),
}))
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
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('../provider-actions/CancelDepositActions', () => ({ CancelDepositActions: () => null }))
jest.mock('../ReceiptReferralNudge', () => ({ ReceiptReferralNudge: () => null }))
jest.mock('../ReceiptSupportLink', () => ({ ReceiptSupportLink: () => null }))
jest.mock('../DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => null }))

import { ReceiptActions } from '../ReceiptActions'

const transaction = {
    id: 'tx-1',
    status: 'pending',
    extraDataForDrawer: {
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: EHistoryUserRole.SENDER,
        kind: 'SEND_LINK',
        link: 'https://peanut.me/claim#p=pw',
    },
} as unknown as TransactionDetails

const vm = {
    isPendingBankRequest: false,
    isPendingRequestee: false,
    isPendingRequester: false,
    isPendingSentLink: true,
} as unknown as ReceiptViewModel

const renderAndCancel = async () => {
    const onClose = jest.fn()
    const setIsLoading = jest.fn()
    render(
        <ReceiptActions
            transaction={transaction}
            vm={vm}
            isPublic={false}
            amountDisplay="$10"
            shouldShowQrShare
            isLoading={false}
            setIsLoading={setIsLoading}
            onClose={onClose}
        />
    )
    fireEvent.click(screen.getByText('actions.cancelLink'))
    fireEvent.click(await screen.findByTestId('confirm-cancel'))
    return { onClose, setIsLoading }
}

beforeEach(() => jest.clearAllMocks())

describe('ReceiptActions — cancel send link outcomes', () => {
    test('already-claimed closes the receipt without ever showing "Cancelled"', async () => {
        mockCancelSendLink.mockResolvedValue('already-claimed')

        const { onClose, setIsLoading } = await renderAndCancel()

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
        expect(screen.queryByText('actions.cancelled')).toBeNull()
        expect(screen.getByText('actions.cancelLink')).toBeInTheDocument()
        expect(screen.queryByTestId('confirm-cancel')).toBeNull()
        expect(setIsLoading).toHaveBeenLastCalledWith(false)
    })

    test('failed keeps the confirm drawer open for a retry and the label idle', async () => {
        mockCancelSendLink.mockResolvedValue('failed')

        const { onClose, setIsLoading } = await renderAndCancel()

        await waitFor(() => expect(setIsLoading).toHaveBeenLastCalledWith(false))
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByTestId('confirm-cancel')).toBeInTheDocument()
        expect(screen.getByText('actions.cancelLink')).toBeInTheDocument()
    })

    test('cancelled shows the "Cancelled" label', async () => {
        mockCancelSendLink.mockResolvedValue('cancelled')

        await renderAndCancel()

        expect(await screen.findByText('actions.cancelled')).toBeInTheDocument()
    })
})
