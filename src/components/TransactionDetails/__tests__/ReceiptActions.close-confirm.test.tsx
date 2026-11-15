/**
 * TASK-23856: "Close request" closed a pot holding $73.65 of $99.16 in one tap.
 * A request that took money now asks first and names what is unpaid; one that
 * took none still cancels in one tap.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'

const mockCloseRequest = jest.fn()

jest.mock('next-intl', () => ({ useLocale: () => 'en' }))
jest.mock('@/i18n/app/useAppTranslations', () => ({
    useAppTranslations: () => (key: string, values?: Record<string, string>) =>
        values ? `${key} ${JSON.stringify(values)}` : key,
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../useReceiptActions', () => ({
    useReceiptActions: () => ({ closeRequest: mockCloseRequest, rejectRequest: jest.fn(), cancelSendLink: jest.fn() }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick, ...rest }: { children?: React.ReactNode; onClick?: () => void }) => (
        <button onClick={onClick} data-testid={(rest as { 'data-testid'?: string })['data-testid']}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Global/Drawer', () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>
    return {
        Drawer: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
            open ? <div role="dialog">{children}</div> : null,
        DrawerContent: Pass,
        DrawerHeader: Pass,
        DrawerTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
        DrawerDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    }
})
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('../provider-actions/CancelDepositActions', () => ({ CancelDepositActions: () => null }))
jest.mock('../useReceiptReferralAction', () => ({ useReceiptReferralAction: () => null }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('../useReceiptPdfFile', () => ({
    useReceiptPdfFile: () => ({ share: jest.fn(), download: jest.fn(), busy: null, unavailable: false, error: false }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }))
jest.mock('../ReceiptMoreActionsDrawer', () => ({ ReceiptMoreActionsDrawer: () => null }))
jest.mock('../ReceiptSupportLink', () => ({ ReceiptSupportLink: () => null }))
jest.mock('../DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => null }))

import { ReceiptActions } from '../ReceiptActions'

const pot = (totalAmountCollected: number) =>
    ({
        id: 'request-1',
        status: 'pending',
        amount: 99.16,
        isRequestPotLink: true,
        totalAmountCollected,
        extraDataForDrawer: {
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            kind: 'P2P_REQUEST_FULFILL',
        },
    }) as unknown as TransactionDetails

const vm = {
    isPendingBankRequest: false,
    isPendingRequestee: false,
    isPendingRequester: true,
    isPendingSentLink: false,
} as unknown as ReceiptViewModel

const renderActions = (transaction: TransactionDetails) => {
    const onClose = jest.fn()
    render(
        <ReceiptActions
            transaction={transaction}
            vm={vm}
            isPublic={false}
            amountDisplay="$73.65 collected"
            shouldShowQrShare={false}
            isLoading={false}
            setIsLoading={jest.fn()}
            onClose={onClose}
        />
    )
    return { onClose }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockCloseRequest.mockResolvedValue(true)
})

test('closing a request that took money asks first and names the unpaid part', () => {
    renderActions(pot(73.65))
    fireEvent.click(screen.getByText('actions.closeRequest'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('actions.closeRequestConfirm.title')).toBeInTheDocument()
    expect(
        screen.getByText('actions.closeRequestConfirm.descriptionUnpaid {"remaining":"$25.51","total":"$99.16"}')
    ).toBeInTheDocument()
    expect(mockCloseRequest).not.toHaveBeenCalled()
})

test('keep open leaves the request open', () => {
    renderActions(pot(73.65))
    fireEvent.click(screen.getByText('actions.closeRequest'))
    fireEvent.click(screen.getByText('actions.closeRequestConfirm.keepOpen'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockCloseRequest).not.toHaveBeenCalled()
})

test('confirming closes the request', async () => {
    const { onClose } = renderActions(pot(73.65))
    fireEvent.click(screen.getByText('actions.closeRequest'))
    fireEvent.click(screen.getByTestId('close-request-confirm'))

    await waitFor(() => expect(mockCloseRequest).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('a request that took nothing still cancels in one tap', async () => {
    renderActions(pot(0))
    fireEvent.click(screen.getByText('actions.cancelRequest'))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(mockCloseRequest).toHaveBeenCalledTimes(1))
})

// TASK-24006: only the payer may cancel an addressed charge (the API answers
// 403 to the requester), so the requester gets no cancel or close control.
test('a pending addressed request shows the requester no cancel control', () => {
    const addressed = {
        id: 'charge-1',
        status: 'pending',
        amount: 10,
        isRequestPotLink: false,
        totalAmountCollected: 0,
        extraDataForDrawer: {
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            kind: 'P2P_REQUEST_FULFILL',
        },
    } as unknown as TransactionDetails
    renderActions(addressed)

    expect(screen.queryByText('actions.cancelRequest')).toBeNull()
    expect(screen.queryByText('actions.closeRequest')).toBeNull()
})
