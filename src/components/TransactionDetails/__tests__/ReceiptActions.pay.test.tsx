/**
 * The Pay CTA on a received request used to assign the absolute peanut.me
 * request link to window.location. Inside the Capacitor WebView that is an
 * off-origin top-level navigation the shell hands to the OS, so the tap left
 * the app. The link must resolve to an in-app route instead.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import type { ReceiptViewModel } from '../useReceiptViewModel'

const mockPush = jest.fn()

jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
// isCapacitor() runs at module load deep in the import chain, so the mocks
// must exist before any const in this file does.
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: jest.fn(),
    openExternalUrl: jest.fn(),
}))
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
const mockIsCapacitor = isCapacitor as jest.Mock
const mockOpenExternalUrl = openExternalUrl as jest.Mock
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: { user: { username: 'payer' } } }) }))
jest.mock('@/hooks/useActivationStatus', () => ({ useActivationStatus: () => ({ isActivated: false }) }))
jest.mock('../useReceiptActions', () => ({
    useReceiptActions: () => ({ closeRequest: jest.fn(), rejectRequest: jest.fn(), cancelSendLink: jest.fn() }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
        <button onClick={onClick}>{children}</button>
    ),
}))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('../provider-actions/CancelDepositActions', () => ({ CancelDepositActions: () => null }))
jest.mock('../ReceiptReferralNudge', () => ({ ReceiptReferralNudge: () => null }))
jest.mock('../ReceiptSupportLink', () => ({ ReceiptSupportLink: () => null }))
jest.mock('../DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => null }))

import { ReceiptActions } from '../ReceiptActions'

const vm = {
    isPendingBankRequest: false,
    isPendingRequestee: true,
    isPendingRequester: false,
    isPendingSentLink: false,
} as unknown as ReceiptViewModel

function renderWithLink(link: string) {
    const transaction = {
        id: 'tx-1',
        status: 'pending',
        extraDataForDrawer: {
            originalType: 'REQUEST',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            link,
        },
    } as unknown as TransactionDetails
    render(
        <ReceiptActions
            transaction={transaction}
            vm={vm}
            isPublic={false}
            amountDisplay="$10"
            shouldShowQrShare={false}
            isLoading={false}
            setIsLoading={jest.fn()}
            onClose={jest.fn()}
        />
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockOpenExternalUrl.mockResolvedValue(undefined)
})

describe('ReceiptActions — Pay on a received request', () => {
    test('pushes the native pay-request route instead of leaving the WebView', () => {
        mockIsCapacitor.mockReturnValue(true)
        renderWithLink('https://peanut.me/alice?chargeId=charge-1')

        fireEvent.click(screen.getByText('actions.pay'))

        expect(mockPush).toHaveBeenCalledWith('/pay-request?chargeId=charge-1')
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })

    test('pushes the same-origin path on web', () => {
        mockIsCapacitor.mockReturnValue(false)
        renderWithLink(`${window.location.origin}/alice?chargeId=charge-1`)

        fireEvent.click(screen.getByText('actions.pay'))

        expect(mockPush).toHaveBeenCalledWith('/alice?chargeId=charge-1')
    })

    test('hands an off-origin link to the browser', () => {
        mockIsCapacitor.mockReturnValue(false)
        renderWithLink('https://example.com/pay')

        fireEvent.click(screen.getByText('actions.pay'))

        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com/pay')
        expect(mockPush).not.toHaveBeenCalled()
    })
})
