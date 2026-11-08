jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { isCapacitor } from '@/utils/capacitor'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'
import type { ReceiptMoreAction } from '../ReceiptMoreActionsDrawer'

jest.mock('next-intl', () => ({ useLocale: () => 'en' }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
import posthog from 'posthog-js'
const mockCapture = posthog.capture as jest.Mock
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
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
// the share sheet and the clipboard copy are ShareButton's own (its tests);
// here it only has to receive the receipt link
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({
        children,
        url,
        title,
        onClick,
    }: {
        children?: React.ReactNode
        url?: string
        title?: string
        onClick?: () => void
    }) => (
        <button data-testid="link-share" data-url={url} data-title={title} onClick={onClick}>
            {children}
        </button>
    ),
}))
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
    CancelDepositActions: ({ confirmOpen }: { confirmOpen: boolean }) => (
        <div data-testid="cancel-confirm-host" data-confirm-open={String(confirmOpen)} />
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

/** `publicReceipt` is the API's per-entry flag (TASK-24141). */
const transaction = (kind: string, { publicReceipt, link }: { publicReceipt?: boolean; link?: string } = {}) =>
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
            publicReceipt,
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

/** The More actions rows, in menu order. */
const menuRows = () =>
    Array.from(screen.getByTestId('more-actions-drawer').querySelectorAll('button')).map((row) =>
        row.getAttribute('data-testid')
    )

/** The buttons on the receipt itself, outside the More actions drawer. */
const receiptButtons = () =>
    screen.getAllByRole('button').filter((b) => b.closest('[data-testid="more-actions-drawer"]') === null)

describe('ReceiptActions hierarchy (TASK-22452, TASK-24141)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockPdfBusy = null
    })

    test('public P2P receipt: Share receipt sends the link, the PDF moves to More actions', () => {
        renderActions(transaction('DIRECT_TRANSFER', { publicReceipt: true }), vm())

        const share = screen.getByTestId('link-share')
        expect(share).toHaveTextContent('actions.shareReceipt')
        expect(share).toHaveAttribute('data-url', expect.stringContaining('/receipt/entry-1?kind=DIRECT_TRANSFER'))
        expect(share).toHaveAttribute('data-title', 'officialReceipt.pdf.title')
        expect(screen.queryByTestId('pdf-share')).not.toBeInTheDocument()
        // two buttons at most: the link share and More actions
        expect(receiptButtons()).toHaveLength(2)
        expect(menuRows()).toEqual(['more-action-share-pdf', 'more-action-download', 'more-action-support'])
        expect(screen.getByTestId('more-action-share-pdf')).toHaveTextContent('actions.sharePdf')
        expect(screen.getByTestId('more-action-download')).toHaveTextContent('actions.downloadPdf')
        // support moved into the drawer — no separate footer link
        expect(screen.queryByTestId('support-link')).not.toBeInTheDocument()
    })

    test.each(['QR_PAY', 'CARD_SPEND_CLEAR'])(
        'public %s receipt: the link is the primary and Split this bill is the first More actions row',
        (kind) => {
            renderActions(transaction(kind, { publicReceipt: true }), vm())

            expect(screen.getByTestId('link-share')).toHaveAttribute(
                'data-url',
                expect.stringContaining(`/receipt/entry-1?kind=${kind}`)
            )
            expect(receiptButtons()).toHaveLength(2)
            expect(menuRows()).toEqual([
                'more-action-split',
                'more-action-share-pdf',
                'more-action-download',
                'more-action-support',
            ])
            expect(screen.getByTestId('more-action-split')).toHaveTextContent('actions.splitBill')
        }
    )

    test('the Split this bill row closes the menu and opens the split request', () => {
        renderActions(transaction('QR_PAY', { publicReceipt: true }), vm())

        fireEvent.click(screen.getByTestId('more-actions-trigger'))
        expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'true')
        fireEvent.click(screen.getByTestId('more-action-split'))

        expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'false')
        expect(mockPush).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/request\?/))
    })

    test('the More actions rows of a public receipt fire their actions', () => {
        renderActions(transaction('QR_PAY', { publicReceipt: true }), vm())

        fireEvent.click(screen.getByTestId('more-actions-trigger'))
        fireEvent.click(screen.getByTestId('more-action-share-pdf'))
        expect(mockPdfShare).toHaveBeenCalledTimes(1)
        // a public receipt downloads from its url (anchor on web) — never
        // through the authenticated file hook
        fireEvent.click(screen.getByTestId('more-action-download'))
        // the receipt state rides the url so the cdn never answers for an older state
        expect(mockOpenReceiptPdfUrl).toHaveBeenCalledWith(
            expect.stringMatching(/^\/receipt\/entry-1\/pdf\?kind=QR_PAY&locale=en&v=.+/)
        )
        expect(mockPdfDownload).not.toHaveBeenCalled()
    })

    test('no public receipt, not splittable: the PDF share stays the primary', () => {
        // the stamped pay link is not a receipt — it is never shared as one
        renderActions(transaction('DIRECT_TRANSFER', { link: 'https://peanut.me/recipient' }), vm())

        expect(screen.queryByTestId('link-share')).not.toBeInTheDocument()
        expect(screen.getByTestId('pdf-share')).toHaveTextContent('actions.shareReceipt')
        fireEvent.click(screen.getByTestId('pdf-share'))
        expect(mockPdfShare).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('public-download')).not.toBeInTheDocument()
        expect(menuRows()).toEqual(['more-action-download', 'more-action-support'])
    })

    test('no public receipt, splittable: Split this bill is the primary, the PDF share joins the drawer', () => {
        renderActions(transaction('QR_PAY'), vm())

        expect(screen.queryByTestId('link-share')).not.toBeInTheDocument()
        expect(screen.queryByTestId('pdf-share')).not.toBeInTheDocument()
        const split = screen.getByText('actions.splitBill')
        expect(receiptButtons()).toHaveLength(2)
        expect(menuRows()).toEqual(['more-action-share-pdf', 'more-action-download', 'more-action-support'])

        fireEvent.click(split)
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/request\?/))
    })

    test('a receipt waiting for a send or request decision never offers the link', () => {
        renderActions(
            transaction('P2P_REQUEST_FULFILL', { publicReceipt: true }),
            vm({ isPendingRequester: true, shouldShowShareReceipt: false, shouldShowDownloadPdf: false })
        )

        expect(screen.queryByTestId('link-share')).not.toBeInTheDocument()
        expect(screen.queryByTestId('pdf-share')).not.toBeInTheDocument()
        expect(screen.queryByTestId('more-actions-trigger')).not.toBeInTheDocument()
    })

    test('a private receipt downloads through the authenticated file hook', () => {
        renderActions(transaction('CARD_SPEND_CLEAR'), vm())

        fireEvent.click(screen.getByTestId('more-action-download'))
        expect(mockPdfDownload).toHaveBeenCalledTimes(1)
        expect(mockOpenReceiptPdfUrl).not.toHaveBeenCalled()
    })

    test('pending file actions disable the file rows, not the url download', () => {
        mockPdfBusy = 'download'
        renderActions(transaction('CARD_SPEND_CLEAR'), vm())
        expect(screen.getByTestId('more-action-share-pdf')).toBeDisabled()
        expect(screen.getByTestId('more-action-download')).toBeDisabled()

        jest.clearAllMocks()
        mockPdfBusy = 'download'
        renderActions(transaction('QR_PAY', { publicReceipt: true }), vm())
        // the url path has no fetch to double-run — it stays enabled
        expect(screen.getAllByTestId('more-action-download').at(-1)).toBeEnabled()
        expect(screen.getAllByTestId('more-action-share-pdf').at(-1)).toBeDisabled()
    })

    test('public receipt: download is the one primary and no account actions render', () => {
        renderActions(transaction('QR_PAY', { publicReceipt: true }), vm({ shouldShowShareReceipt: false }), true)

        expect(screen.getByTestId('public-download')).toBeInTheDocument()
        expect(screen.queryByTestId('link-share')).not.toBeInTheDocument()
        expect(screen.queryByText('actions.splitBill')).not.toBeInTheDocument()
        expect(screen.queryByTestId('more-actions-trigger')).not.toBeInTheDocument()
        expect(screen.queryByTestId('more-action-share-pdf')).not.toBeInTheDocument()
        // support stays reachable outside the drawer
        expect(screen.getByTestId('support-link')).toBeInTheDocument()
    })

    const pendingDeposit = (publicReceipt?: boolean) =>
        ({
            ...transaction('ONRAMP'),
            direction: 'bank_deposit',
            status: 'pending',
            extraDataForDrawer: {
                kind: 'ONRAMP',
                provider: 'BRIDGE',
                publicReceipt,
                depositInstructions: { deposit_message: 'BRGTESTREF' },
            },
        }) as unknown as TransactionDetails
    const pendingBankRequest = {
        ...transaction('P2P_REQUEST_FULFILL'),
        status: 'pending',
        extraDataForDrawer: {
            kind: 'P2P_REQUEST_FULFILL',
            originalUserRole: EHistoryUserRole.SENDER,
            fulfillmentType: 'bridge',
        },
    } as unknown as TransactionDetails

    test.each([
        ['pending bank deposit', pendingDeposit(), vm(), 'pdf-share', 'actions.cancelDeposit'],
        [
            'pending bank deposit with a public receipt',
            pendingDeposit(true),
            vm(),
            'link-share',
            'actions.cancelDeposit',
        ],
        [
            'pending bank-paid request (sender)',
            pendingBankRequest,
            vm({ isPendingBankRequest: true }),
            'pdf-share',
            'actions.cancelDepositRequest',
        ],
    ])(
        '%s: share is the primary, cancel is a More actions row that opens the confirm',
        (_, tx, viewModel, primary, label) => {
            render(
                <ReceiptActions
                    transaction={tx}
                    vm={viewModel}
                    isPublic={false}
                    amountDisplay="$10"
                    shouldShowQrShare={false}
                    setIsLoading={jest.fn()}
                    onClose={jest.fn()}
                />
            )

            // two buttons at most: share + more actions, never a cancel button
            expect(screen.getByTestId(primary)).toBeInTheDocument()
            expect(screen.getByTestId('more-actions-trigger')).toBeInTheDocument()
            expect(receiptButtons()).toHaveLength(2)

            const confirmHost = screen.getByTestId('cancel-confirm-host')
            expect(confirmHost).toHaveAttribute('data-confirm-open', 'false')
            expect(screen.getByTestId('more-action-cancel')).toHaveTextContent(label)

            fireEvent.click(screen.getByTestId('more-actions-trigger'))
            fireEvent.click(screen.getByTestId('more-action-cancel'))
            // the row closes the menu and opens the shared confirm
            expect(screen.getByTestId('more-actions-drawer')).toHaveAttribute('data-open', 'false')
            expect(confirmHost).toHaveAttribute('data-confirm-open', 'true')
        }
    )

    test('pending → completed → pending: the confirm stays closed and the parent lock is released', () => {
        const setIsModalOpen = jest.fn()
        const props = {
            vm: vm(),
            isPublic: false,
            amountDisplay: '$10',
            shouldShowQrShare: false,
            setIsLoading: jest.fn(),
            onClose: jest.fn(),
            setIsModalOpen,
        }
        const { rerender } = render(<ReceiptActions transaction={pendingDeposit()} {...props} />)
        fireEvent.click(screen.getByTestId('more-action-cancel'))
        expect(screen.getByTestId('cancel-confirm-host')).toHaveAttribute('data-confirm-open', 'true')
        expect(setIsModalOpen).toHaveBeenLastCalledWith(true)

        const completed = { ...pendingDeposit(), status: 'completed' } as unknown as TransactionDetails
        rerender(<ReceiptActions transaction={completed} {...props} />)
        expect(screen.queryByTestId('cancel-confirm-host')).not.toBeInTheDocument()
        expect(setIsModalOpen).toHaveBeenLastCalledWith(false)

        // a stale refetch shows the entry as pending again
        rerender(<ReceiptActions transaction={pendingDeposit()} {...props} />)
        expect(screen.getByTestId('cancel-confirm-host')).toHaveAttribute('data-confirm-open', 'false')
        expect(setIsModalOpen).toHaveBeenLastCalledWith(false)
    })
})

test('native Download PDF uses the file bridge for public receipts too', () => {
    ;(isCapacitor as jest.Mock).mockReturnValue(true)
    try {
        renderActions(transaction('OFFRAMP', { publicReceipt: true }), vm())
        fireEvent.click(screen.getByTestId('more-action-download'))
        expect(mockPdfDownload).toHaveBeenCalled()
        expect(mockOpenReceiptPdfUrl).not.toHaveBeenCalled()
    } finally {
        ;(isCapacitor as jest.Mock).mockReturnValue(false)
    }
})

/**
 * Every receipt action records one `receipt_action_tapped` with what was
 * tapped and where it sat, so the link primary and the More actions rows can
 * be compared (TASK-24141). The tap is recorded, not its outcome.
 */
describe('receipt action events (TASK-24141)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockPdfBusy = null
    })

    const tapped = (action: string, placement: string, kind: string) =>
        expect(mockCapture).toHaveBeenCalledWith('receipt_action_tapped', { action, placement, kind })

    test('the link primary records share_link', () => {
        renderActions(transaction('DIRECT_TRANSFER', { publicReceipt: true }), vm())

        fireEvent.click(screen.getByTestId('link-share'))
        tapped('share_link', 'primary', 'DIRECT_TRANSFER')
        expect(mockCapture).toHaveBeenCalledTimes(1)
    })

    test('the More actions rows record split, share_pdf and download_pdf', () => {
        renderActions(transaction('QR_PAY', { publicReceipt: true }), vm())

        fireEvent.click(screen.getByTestId('more-action-split'))
        tapped('split', 'more_actions', 'QR_PAY')
        fireEvent.click(screen.getByTestId('more-action-share-pdf'))
        tapped('share_pdf', 'more_actions', 'QR_PAY')
        expect(mockPdfShare).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByTestId('more-action-download'))
        tapped('download_pdf', 'more_actions', 'QR_PAY')
        expect(mockCapture).toHaveBeenCalledTimes(3)
    })

    test('a Split this bill primary records split as primary', () => {
        renderActions(transaction('QR_PAY'), vm())

        fireEvent.click(screen.getByText('actions.splitBill'))
        tapped('split', 'primary', 'QR_PAY')
    })

    test('a PDF share primary records share_pdf as primary', () => {
        renderActions(transaction('DIRECT_TRANSFER'), vm())

        fireEvent.click(screen.getByTestId('pdf-share'))
        tapped('share_pdf', 'primary', 'DIRECT_TRANSFER')
        expect(mockPdfShare).toHaveBeenCalledTimes(1)
    })
})
