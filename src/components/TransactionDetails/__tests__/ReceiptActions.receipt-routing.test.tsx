import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'
import type { ReceiptMoreAction } from '../ReceiptMoreActionsDrawer'

jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn().mockReturnValue(false),
    isIOSNative: jest.fn().mockReturnValue(false),
    isAndroidNative: jest.fn().mockReturnValue(false),
    isLegacyWebKit: jest.fn().mockReturnValue(false),
    openExternalUrl: jest.fn(),
}))
jest.mock('../useReceiptActions', () => ({
    useReceiptActions: () => ({ closeRequest: jest.fn(), rejectRequest: jest.fn(), cancelSendLink: jest.fn() }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
        ...rest
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
        <button onClick={onClick} disabled={disabled} data-testid={(rest as Record<string, string>)['data-testid']}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
const mockShareUrl = jest.fn()
jest.mock('@/components/Global/ShareButton/useShareAction', () => ({
    useShareAction: () => mockShareUrl,
}))
const mockPdfShare = jest.fn()
const mockPdfDownload = jest.fn()
jest.mock('../useReceiptPdfFile', () => ({
    useReceiptPdfFile: jest.fn(() => ({
        share: mockPdfShare,
        download: mockPdfDownload,
        busy: null,
        unavailable: false,
        error: false,
    })),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))
jest.mock('../useReceiptReferralAction', () => ({ useReceiptReferralAction: () => null }))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('../provider-actions/CancelDepositActions', () => ({ CancelDepositActions: () => null }))
jest.mock('../ReceiptSupportLink', () => ({ ReceiptSupportLink: () => <div data-testid="support-link" /> }))
jest.mock('../DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => <div data-testid="public-download" /> }))
// the drawer mock surfaces its rows as buttons so the menu is testable
jest.mock('../ReceiptMoreActionsDrawer', () => ({
    ReceiptMoreActionsDrawer: ({ open, actions }: { open: boolean; actions: ReceiptMoreAction[] }) => (
        <div data-testid="more-actions-drawer" data-open={open}>
            {actions.map((action) => (
                <button key={action.title + action.icon} data-testid={action['data-testid']} onClick={action.onSelect}>
                    {action.title}
                </button>
            ))}
        </div>
    ),
}))

import { ReceiptActions } from '../ReceiptActions'

const vm = (overrides: Partial<ReceiptViewModel> = {}) =>
    ({
        isPendingBankRequest: false,
        isPendingRequestee: false,
        isPendingRequester: false,
        isPendingSentLink: false,
        shouldShowShareReceipt: true,
        shouldShowDownloadPdf: true,
        ...overrides,
    }) as ReceiptViewModel

const transaction = (kind: string, link?: string) =>
    ({
        id: 'entry-1',
        amount: 10,
        direction: 'send',
        status: 'completed',
        userName: 'recipient',
        totalAmountCollected: 0,
        extraDataForDrawer: {
            kind,
            link,
            originalUserRole: EHistoryUserRole.SENDER,
        },
    }) as unknown as TransactionDetails

const renderActions = (tx: TransactionDetails, viewModel: ReceiptViewModel, isPublic = false) =>
    render(
        <ReceiptActions
            transaction={tx}
            vm={viewModel}
            isPublic={isPublic}
            amountDisplay="$10"
            shouldShowQrShare={false}
        />
    )

describe('ReceiptActions hierarchy (TASK-22452)', () => {
    beforeEach(() => jest.clearAllMocks())

    test('nonsplittable private kind: pdf share is the primary; download + support live in the drawer', () => {
        renderActions(transaction('DIRECT_TRANSFER', 'https://peanut.me/recipient'), vm())

        expect(screen.getByTestId('private-pdf-share')).toBeInTheDocument()
        expect(screen.queryByTestId('public-share')).not.toBeInTheDocument()
        expect(screen.queryByTestId('public-download')).not.toBeInTheDocument()
        // no duplicate share row when share owns the primary slot
        expect(screen.queryByTestId('more-action-share')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-download')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-support')).toBeInTheDocument()
        // support moved into the drawer — no separate footer link
        expect(screen.queryByTestId('support-link')).not.toBeInTheDocument()
    })

    test('nonsplittable capability kind: url share primary, download demoted to the drawer', () => {
        renderActions(transaction('OFFRAMP'), vm())

        expect(screen.getByTestId('public-share')).toBeInTheDocument()
        expect(screen.queryByTestId('private-pdf-share')).not.toBeInTheDocument()
        expect(screen.queryByTestId('public-download')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-download')).toBeInTheDocument()
    })

    test('splittable payment: split primary, share joins the drawer', () => {
        renderActions(transaction('QR_PAY'), vm())

        expect(screen.getByText('actions.splitBill')).toBeInTheDocument()
        expect(screen.queryByTestId('public-share')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-share')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-download')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-support')).toBeInTheDocument()
    })

    test('the more-actions trigger opens the drawer and rows fire their actions', () => {
        renderActions(transaction('QR_PAY'), vm())

        expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'false')
        fireEvent.click(screen.getByTestId('more-actions-trigger'))
        expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'true')

        fireEvent.click(screen.getByTestId('more-action-share'))
        expect(mockShareUrl).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByTestId('more-action-download'))
        expect(mockPdfDownload).toHaveBeenCalledTimes(1)
    })

    test('public receipt: download is the one primary and no account actions render', () => {
        renderActions(transaction('QR_PAY'), vm({ shouldShowShareReceipt: false }), true)

        expect(screen.getByTestId('public-download')).toBeInTheDocument()
        expect(screen.queryByText('actions.splitBill')).not.toBeInTheDocument()
        expect(screen.queryByTestId('more-actions-trigger')).not.toBeInTheDocument()
        expect(screen.queryByTestId('more-action-share')).not.toBeInTheDocument()
        // support stays reachable outside the drawer
        expect(screen.getByTestId('support-link')).toBeInTheDocument()
    })
})
