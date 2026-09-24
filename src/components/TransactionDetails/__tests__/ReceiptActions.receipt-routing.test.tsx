import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'
import type { ReceiptMoreAction } from '../ReceiptMoreActionsDrawer'

jest.mock('next-intl', () => ({ useLocale: () => 'en' }))
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
const mockCopy = jest.fn()
jest.mock('@/utils/clipboard.utils', () => ({ copyTextToClipboard: (text: string) => mockCopy(text) }))
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
const mockPdfShare = jest.fn()
const mockPdfDownload = jest.fn()
let mockPdfBusy: 'share' | 'download' | null = null
jest.mock('../useReceiptPdfFile', () => ({
    useReceiptPdfFile: jest.fn(() => ({
        share: mockPdfShare,
        download: mockPdfDownload,
        busy: mockPdfBusy,
        unavailable: false,
        error: false,
    })),
}))
const mockOpenReceiptPdfUrl = jest.fn()
jest.mock('../receipt-pdf-link.utils', () => ({
    ...jest.requireActual('../receipt-pdf-link.utils'),
    openReceiptPdfUrl: (path: string) => mockOpenReceiptPdfUrl(path),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))
jest.mock('../useReceiptReferralAction', () => ({ useReceiptReferralAction: () => null }))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('../provider-actions/CancelDepositActions', () => ({
    CancelDepositActions: ({ primary }: { primary?: boolean }) => (
        <div data-testid="cancel-deposit" data-primary={String(!!primary)} />
    ),
}))
jest.mock('../ReceiptSupportLink', () => ({ ReceiptSupportLink: () => <div data-testid="support-link" /> }))
jest.mock('../DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => <div data-testid="public-download" /> }))
// the drawer mock surfaces its rows as buttons so the menu is testable
jest.mock('../ReceiptMoreActionsDrawer', () => ({
    ReceiptMoreActionsDrawer: ({ open, actions }: { open: boolean; actions: ReceiptMoreAction[] }) => (
        <div data-testid="more-actions-drawer" data-open={open}>
            {actions.map((action) => (
                <button
                    key={action.title + action.icon}
                    data-testid={action['data-testid']}
                    onClick={action.onSelect}
                    disabled={action.disabled}
                >
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
    beforeEach(() => {
        jest.clearAllMocks()
        mockPdfBusy = null
    })

    test('nonsplittable private kind: pdf share is the primary; download + support live in the drawer', () => {
        renderActions(transaction('DIRECT_TRANSFER', 'https://peanut.me/recipient'), vm())

        expect(screen.getByTestId('pdf-share')).toBeInTheDocument()
        expect(screen.queryByTestId('public-download')).not.toBeInTheDocument()
        // no duplicate share row when share owns the primary slot
        expect(screen.queryByTestId('more-action-share')).not.toBeInTheDocument()
        // the stamped pay link is not a public receipt — never offered as a copy
        expect(screen.queryByTestId('more-action-copy-link')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-download')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-support')).toBeInTheDocument()
        // support moved into the drawer — no separate footer link
        expect(screen.queryByTestId('support-link')).not.toBeInTheDocument()
    })

    test('nonsplittable capability kind: the same pdf share primary, copy link + download in the drawer', () => {
        renderActions(transaction('OFFRAMP'), vm())

        fireEvent.click(screen.getByTestId('pdf-share'))
        expect(mockPdfShare).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('public-download')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-copy-link')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-download')).toBeInTheDocument()
    })

    test('splittable payment: split primary, share joins the drawer', () => {
        renderActions(transaction('QR_PAY'), vm())

        expect(screen.getByText('actions.splitBill')).toBeInTheDocument()
        expect(screen.queryByTestId('pdf-share')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-share')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-download')).toBeInTheDocument()
        expect(screen.getByTestId('more-action-support')).toBeInTheDocument()
    })

    test('the more-actions trigger opens the drawer and rows fire their actions', () => {
        renderActions(transaction('QR_PAY'), vm())

        expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'false')
        fireEvent.click(screen.getByTestId('more-actions-trigger'))
        expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'true')

        // a qr payment shares the pdf file, exactly like a p2p send
        fireEvent.click(screen.getByTestId('more-action-share'))
        expect(mockPdfShare).toHaveBeenCalledTimes(1)
        // qr pay is a public-capability kind: its drawer download keeps the
        // pre-existing url path (anchor/web, system browser/native) — never
        // the authenticated file hook
        fireEvent.click(screen.getByTestId('more-action-download'))
        expect(mockOpenReceiptPdfUrl).toHaveBeenCalledWith('/receipt/entry-1/pdf?kind=QR_PAY&locale=en')
        expect(mockPdfDownload).not.toHaveBeenCalled()
    })

    test('copy link copies the public receipt url and confirms it', async () => {
        mockCopy.mockResolvedValue(true)
        renderActions(transaction('QR_PAY'), vm())

        fireEvent.click(screen.getByTestId('more-action-copy-link'))
        await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('actions.linkCopied'))
        expect(mockCopy).toHaveBeenCalledWith(expect.stringContaining('/receipt/entry-1?kind=QR_PAY'))
    })

    test('a failed copy says so', async () => {
        mockCopy.mockResolvedValue(false)
        renderActions(transaction('OFFRAMP'), vm())

        fireEvent.click(screen.getByTestId('more-action-copy-link'))
        await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('actions.linkCopyFailed'))
    })

    test('a private kind downloads through the authenticated file hook', () => {
        renderActions(transaction('CARD_SPEND_CLEAR'), vm())

        fireEvent.click(screen.getByTestId('more-action-download'))
        expect(mockPdfDownload).toHaveBeenCalledTimes(1)
        expect(mockOpenReceiptPdfUrl).not.toHaveBeenCalled()
    })

    test('pending file actions disable the private drawer rows, not the url download', () => {
        mockPdfBusy = 'download'
        renderActions(transaction('CARD_SPEND_CLEAR'), vm())
        expect(screen.getByTestId('more-action-share')).toBeDisabled()
        expect(screen.getByTestId('more-action-download')).toBeDisabled()

        jest.clearAllMocks()
        mockPdfBusy = 'download'
        renderActions(transaction('QR_PAY'), vm())
        // the url path has no fetch to double-run — it stays enabled
        expect(screen.getAllByTestId('more-action-download').at(-1)).toBeEnabled()
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

    test('pending bank deposit: cancel is the primary above more actions, share joins the drawer', () => {
        const pendingDeposit = {
            ...transaction('ONRAMP'),
            direction: 'bank_deposit',
            status: 'pending',
            extraDataForDrawer: {
                kind: 'ONRAMP',
                provider: 'BRIDGE',
                depositInstructions: { deposit_message: 'BRGTESTREF' },
            },
        } as unknown as TransactionDetails
        render(
            <ReceiptActions
                transaction={pendingDeposit}
                vm={vm()}
                isPublic={false}
                amountDisplay="$10"
                shouldShowQrShare={false}
                setIsLoading={jest.fn()}
                onClose={jest.fn()}
            />
        )

        const cancel = screen.getByTestId('cancel-deposit')
        expect(cancel).toHaveAttribute('data-primary', 'true')
        expect(screen.queryByTestId('pdf-share')).not.toBeInTheDocument()
        expect(screen.getByTestId('more-action-share')).toBeInTheDocument()
        expect(
            cancel.compareDocumentPosition(screen.getByTestId('more-actions-trigger')) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })
})
