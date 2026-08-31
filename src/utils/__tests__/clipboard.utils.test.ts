import { beginClipboardCopy, copyTextToClipboard } from '../clipboard.utils'

const mockIsNativeBridge = jest.fn<boolean, []>()
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => mockIsNativeBridge(),
}))

const mockNativeWrite = jest.fn()
jest.mock('@capacitor/clipboard', () => ({
    Clipboard: { write: (options: { string: string }) => mockNativeWrite(options) },
}))

class ClipboardItemStub {
    constructor(public data: Record<string, Promise<Blob> | Blob | string>) {}
}

const LINK = 'https://peanut.me/request/pay?id=req-uuid-1'

// jsdom's Blob has no text()
const readBlob = (blob: Blob) =>
    new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsText(blob)
    })

let write: jest.Mock
let writeText: jest.Mock
let consoleErrorSpy: jest.SpyInstance

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext')

beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockIsNativeBridge.mockReturnValue(false)
    mockNativeWrite.mockResolvedValue(undefined)
    write = jest.fn().mockResolvedValue(undefined)
    writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write, writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    ;(globalThis as { ClipboardItem?: unknown }).ClipboardItem = ClipboardItemStub
})

afterEach(() => {
    consoleErrorSpy.mockRestore()
    delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem
})

afterAll(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else delete (navigator as unknown as Record<string, unknown>).clipboard
    if (originalSecureContext) Object.defineProperty(window, 'isSecureContext', originalSecureContext)
})

describe('beginClipboardCopy', () => {
    // WebKit only honours a write while the click's activation is live, so the
    // write has to start before the request that mints the text is awaited.
    it('starts the write before the text exists and fills it in later', async () => {
        const pending = beginClipboardCopy()

        expect(write).toHaveBeenCalledTimes(1)

        await expect(pending.resolve(LINK)).resolves.toBe(true)
        expect(writeText).not.toHaveBeenCalled()

        const item = write.mock.calls[0][0][0] as ClipboardItemStub
        await expect(readBlob(await (item.data['text/plain'] as Promise<Blob>))).resolves.toBe(LINK)
    })

    it('falls back to a plain write when the reservation is rejected', async () => {
        write.mockRejectedValue(new Error('denied'))

        const pending = beginClipboardCopy()

        await expect(pending.resolve(LINK)).resolves.toBe(true)
        expect(writeText).toHaveBeenCalledWith(LINK)
    })

    it('reports failure when neither the reservation nor the plain write lands', async () => {
        write.mockRejectedValue(new Error('denied'))
        writeText.mockRejectedValue(new Error('denied'))

        await expect(beginClipboardCopy().resolve(LINK)).resolves.toBe(false)
    })

    // an abandoned reservation must settle — a hanging write blocks the next one
    it('settles the reservation when the text never arrives', async () => {
        const pending = beginClipboardCopy()

        expect(() => pending.cancel()).not.toThrow()
        await Promise.resolve()

        expect(writeText).not.toHaveBeenCalled()
    })

    it('copies directly when the browser cannot reserve the clipboard', async () => {
        delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem

        await expect(beginClipboardCopy().resolve(LINK)).resolves.toBe(true)
        expect(write).not.toHaveBeenCalled()
        expect(writeText).toHaveBeenCalledWith(LINK)
    })

    it('copies through the native plugin instead of reserving', async () => {
        mockIsNativeBridge.mockReturnValue(true)

        await expect(beginClipboardCopy().resolve(LINK)).resolves.toBe(true)
        expect(write).not.toHaveBeenCalled()
        expect(mockNativeWrite).toHaveBeenCalledWith({ string: LINK })
    })
})

describe('copyTextToClipboard', () => {
    it('prefers the native plugin over the webview clipboard', async () => {
        mockIsNativeBridge.mockReturnValue(true)

        await expect(copyTextToClipboard(LINK)).resolves.toBe(true)
        expect(mockNativeWrite).toHaveBeenCalledWith({ string: LINK })
        expect(writeText).not.toHaveBeenCalled()
    })

    it('falls back to the webview clipboard when the native plugin fails', async () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockNativeWrite.mockRejectedValue(new Error('no plugin'))

        await expect(copyTextToClipboard(LINK)).resolves.toBe(true)
        expect(writeText).toHaveBeenCalledWith(LINK)
    })

    it('reports failure when the write is refused', async () => {
        writeText.mockRejectedValue(new Error('denied'))

        await expect(copyTextToClipboard(LINK)).resolves.toBe(false)
    })
})
