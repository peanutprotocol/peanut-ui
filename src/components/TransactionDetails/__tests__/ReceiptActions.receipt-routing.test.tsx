import React from 'react'
import { render, screen } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'

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
    Button: ({ children }: { children?: React.ReactNode }) => children,
}))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <div data-testid="public-share">{children}</div>,
}))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('../provider-actions/CancelDepositActions', () => ({ CancelDepositActions: () => null }))
jest.mock('../ReceiptSupportLink', () => ({ ReceiptSupportLink: () => null }))
jest.mock('../DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => <div data-testid="public-download" /> }))
jest.mock('../PrivateReceiptPdfActions', () => ({
    PrivateReceiptPdfActions: ({ entryId, kind }: { entryId: string; kind: string }) => (
        <div data-testid="private-pdf-actions">{`${entryId}:${kind}`}</div>
    ),
}))

import { ReceiptActions } from '../ReceiptActions'

const vm = {
    isPendingBankRequest: false,
    isPendingRequestee: false,
    isPendingRequester: false,
    isPendingSentLink: false,
    shouldShowShareReceipt: true,
    shouldShowDownloadPdf: true,
} as ReceiptViewModel

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

describe('ReceiptActions receipt routing', () => {
    test('uses authenticated PDF actions when a private transaction retains a payment link', () => {
        render(
            <ReceiptActions
                transaction={transaction('DIRECT_TRANSFER', 'https://peanut.me/recipient')}
                vm={vm}
                isPublic={false}
                amountDisplay="$10"
                shouldShowQrShare={false}
            />
        )

        expect(screen.getByTestId('private-pdf-actions')).toHaveTextContent('entry-1:DIRECT_TRANSFER')
        expect(screen.queryByTestId('public-share')).not.toBeInTheDocument()
        expect(screen.queryByTestId('public-download')).not.toBeInTheDocument()
    })

    test('keeps capability receipt kinds on public share and download actions', () => {
        render(
            <ReceiptActions
                transaction={transaction('OFFRAMP')}
                vm={vm}
                isPublic={false}
                amountDisplay="$10"
                shouldShowQrShare={false}
            />
        )

        expect(screen.getByTestId('public-share')).toBeInTheDocument()
        expect(screen.getByTestId('public-download')).toBeInTheDocument()
        expect(screen.queryByTestId('private-pdf-actions')).not.toBeInTheDocument()
    })
})
