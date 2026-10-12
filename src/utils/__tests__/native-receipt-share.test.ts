import { NativeReceiptShareUnavailable, shareNativeReceipt } from '../native-receipt-share'

const mockSharePdf = jest.fn()
let mockNative = true
jest.mock('@capacitor/core', () => ({
    registerPlugin: () => ({ sharePdf: (...args: unknown[]) => mockSharePdf(...args) }),
}))
jest.mock('../capacitor', () => ({
    isNativeBridge: () => mockNative,
    isAndroidNative: () => mockNative,
    isIOSNative: () => false,
}))

beforeEach(() => {
    mockNative = true
    mockSharePdf.mockReset().mockResolvedValue({})
})

test('passes the authenticated PDF bytes and filename to the native bridge', async () => {
    await shareNativeReceipt(new Blob(['%PDF-private'], { type: 'application/pdf' }), 'receipt.pdf', 'Receipt')
    expect(mockSharePdf).toHaveBeenCalledWith({ data: btoa('%PDF-private'), filename: 'receipt.pdf', title: 'Receipt' })
})

test('a missing bridge on an older binary is distinguishable from a delivery error', async () => {
    mockSharePdf.mockRejectedValue({ code: 'UNIMPLEMENTED' })
    await expect(shareNativeReceipt(new Blob(['pdf']), 'receipt.pdf', 'Receipt')).rejects.toBeInstanceOf(
        NativeReceiptShareUnavailable
    )
    const failure = new Error('Unable to present share sheet')
    mockSharePdf.mockRejectedValue(failure)
    await expect(shareNativeReceipt(new Blob(['pdf']), 'receipt.pdf', 'Receipt')).rejects.toBe(failure)
})

test('a native-flavoured preview without a bridge never invokes a native method', async () => {
    mockNative = false
    await expect(shareNativeReceipt(new Blob(['pdf']), 'receipt.pdf', 'Receipt')).rejects.toBeInstanceOf(
        NativeReceiptShareUnavailable
    )
    expect(mockSharePdf).not.toHaveBeenCalled()
})

test('closing the native sheet without sharing is a quiet completion', async () => {
    mockSharePdf.mockResolvedValue({ cancelled: true })
    await expect(shareNativeReceipt(new Blob(['pdf']), 'receipt.pdf', 'Receipt')).resolves.toBeUndefined()
})

test('a receipt changed or unmounted during file encoding never opens a stale sheet', async () => {
    let current = true
    const pending = shareNativeReceipt(new Blob(['%PDF-old']), 'old.pdf', 'Receipt', () => current)
    current = false
    await pending
    expect(mockSharePdf).not.toHaveBeenCalled()
})
