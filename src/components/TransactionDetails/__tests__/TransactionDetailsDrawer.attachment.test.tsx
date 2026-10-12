import React, { useState } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CapacitorHttp } from '@capacitor/core'
import { Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { renderWithIntl } from '@/test-utils/intl'
import { TransactionDetailsDrawer } from '../TransactionDetailsDrawer'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => null }))
jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
jest.mock('../TransactionDetailsHeaderCard', () => ({ TransactionDetailsHeaderCard: () => null }))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('@/components/Global/Drawer', () => ({
    // keep the receipt mounted while closed, as it is during the exit animation.
    Drawer: ({
        open,
        onOpenChange,
        children,
    }: {
        open: boolean
        onOpenChange: (open: boolean) => void
        children: React.ReactNode
    }) => (
        <section data-testid="retained-receipt" data-open={open}>
            <button onClick={() => onOpenChange(false)}>Close receipt</button>
            {children}
        </section>
    ),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@capacitor/core', () => ({
    Capacitor: { isPluginAvailable: jest.fn(() => true) },
    CapacitorHttp: { request: jest.fn() },
}))
jest.mock('@capacitor/filesystem', () => ({
    Directory: { Cache: 'CACHE' },
    Filesystem: { writeFile: jest.fn(), deleteFile: jest.fn(), readdir: jest.fn() },
}))
jest.mock('@capacitor/share', () => ({ Share: { share: jest.fn() } }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isNativeBridge: jest.fn(() => true),
    isCapacitor: jest.fn(() => true),
    openExternalUrl: jest.fn(),
}))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))

const transaction: TransactionDetails = {
    id: 'receipt-attachment',
    direction: 'send',
    userName: 'Ana',
    fullName: 'Ana',
    initials: 'AN',
    amount: 25,
    totalAmountCollected: 0,
    status: 'completed',
    date: '2026-10-01T10:00:00Z',
    attachmentUrl: 'https://peanut-notes.s3.eu-north-1.amazonaws.com/receipt.pdf',
}

function RetainedReceipt() {
    const [isOpen, setIsOpen] = useState(true)
    return <TransactionDetailsDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} transaction={transaction} />
}

beforeEach(() => {
    jest.clearAllMocks()
    ;(CapacitorHttp.request as jest.Mock).mockResolvedValue({
        status: 200,
        data: btoa('%PDF-1.7\nreceipt'),
        url: transaction.attachmentUrl,
    })
    ;(Filesystem.readdir as jest.Mock).mockResolvedValue({ files: [] })
    ;(Filesystem.deleteFile as jest.Mock).mockResolvedValue(undefined)
    ;(Share.share as jest.Mock).mockResolvedValue({ activityType: '' })
})

test('closing a mounted receipt during a native file write prevents the share sheet', async () => {
    let finishWrite!: (result: { uri: string }) => void
    ;(Filesystem.writeFile as jest.Mock).mockReturnValue(new Promise((resolve) => (finishWrite = resolve)))
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <ToastProvider>
                <RetainedReceipt />
            </ToastProvider>
        </QueryClientProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
    await waitFor(() => expect(Filesystem.writeFile).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Close receipt' }))
    expect(screen.getByTestId('retained-receipt')).toHaveAttribute('data-open', 'false')
    expect(screen.getByText('Attachment')).toBeInTheDocument()
    await act(async () => finishWrite({ uri: 'file:///cache/receipt.pdf' }))
    expect(Share.share).not.toHaveBeenCalled()
    await waitFor(() => expect(Filesystem.deleteFile).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
})
