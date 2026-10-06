import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ReceiptAttachmentRow } from '../ReceiptAttachmentRow'
import { canDeliverReceiptAttachment, deliverReceiptAttachment, fetchReceiptAttachment } from '../receipt-attachment'

jest.mock('../receipt-attachment', () => ({
    canDeliverReceiptAttachment: jest.fn(() => true),
    deliverReceiptAttachment: jest.fn(),
    fetchReceiptAttachment: jest.fn(),
}))

const url = 'https://peanut-notes.s3.eu-north-1.amazonaws.com/receipt.pdf'
const file = { bytes: new Uint8Array([37, 80, 68, 70, 45]), mimeType: 'application/pdf', extension: 'pdf' }

beforeEach(() => {
    jest.clearAllMocks()
    ;(canDeliverReceiptAttachment as jest.Mock).mockReturnValue(true)
    ;(fetchReceiptAttachment as jest.Mock).mockResolvedValue(file)
    ;(deliverReceiptAttachment as jest.Mock).mockResolvedValue(undefined)
})

test('offers Download only after the attachment bytes have been verified', async () => {
    let resolve!: (value: typeof file) => void
    ;(fetchReceiptAttachment as jest.Mock).mockReturnValue(new Promise((done) => (resolve = done)))
    renderWithIntl(<ReceiptAttachmentRow url={url} />)
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await act(async () => resolve(file))
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
    await waitFor(() => expect(deliverReceiptAttachment).toHaveBeenCalledWith(file))
    expect(fetchReceiptAttachment).toHaveBeenCalledTimes(1)
})

test.each(['expired URL', 'relative URL', '404', 'non-PDF error page'])(
    'shows an actionable error for %s, with no route to the 404 page',
    async (message) => {
        ;(fetchReceiptAttachment as jest.Mock).mockRejectedValueOnce(new Error(message))
        renderWithIntl(<ReceiptAttachmentRow url={url} />)
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Attachment is unavailable. Try again or contact support.'
        )
        expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(await screen.findByRole('button', { name: 'Download' })).toBeEnabled()
    }
)

test('an old native binary asks for an update instead of pretending to download', async () => {
    ;(canDeliverReceiptAttachment as jest.Mock).mockReturnValue(false)
    renderWithIntl(<ReceiptAttachmentRow url={url} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Update Peanut to download this attachment.')
    expect(fetchReceiptAttachment).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
})

test('does not deliver a previous attachment after the receipt changes', async () => {
    let resolveOld!: (value: typeof file) => void
    ;(fetchReceiptAttachment as jest.Mock)
        .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
        .mockRejectedValueOnce(new Error('missing new attachment'))
    const { rerender } = renderWithIntl(<ReceiptAttachmentRow url={url} />)
    rerender(<ReceiptAttachmentRow url={`${url}?version=2`} />)
    await act(async () => resolveOld(file))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(deliverReceiptAttachment).not.toHaveBeenCalled()
})

test('two quick taps cannot launch two native share sheets', async () => {
    ;(deliverReceiptAttachment as jest.Mock).mockReturnValue(new Promise(() => {}))
    renderWithIntl(<ReceiptAttachmentRow url={url} />)
    const download = await screen.findByRole('button', { name: 'Download' })
    fireEvent.click(download)
    fireEvent.click(download)
    expect(deliverReceiptAttachment).toHaveBeenCalledTimes(1)
    expect(download).toBeDisabled()
})

test('a delivery failure keeps the cached bytes available for retry', async () => {
    ;(deliverReceiptAttachment as jest.Mock).mockRejectedValueOnce(new Error('share failed'))
    renderWithIntl(<ReceiptAttachmentRow url={url} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(deliverReceiptAttachment).toHaveBeenCalledTimes(2))
    expect(fetchReceiptAttachment).toHaveBeenCalledTimes(1)
})
