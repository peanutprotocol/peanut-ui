// clipboardHasStrings gates the iOS QR-scanner paste chip: prompt-free on iOS
// native, and silently false everywhere the plugin can't answer (web, Android,
// older binaries running OTA'd JS).
import { clipboardHasStrings } from '../clipboard-detect'
import { isIOSNative } from '../capacitor'

const hasStrings = jest.fn()

jest.mock('@capacitor/core', () => ({
    registerPlugin: jest.fn(() => ({ hasStrings: () => hasStrings() })),
}))

jest.mock('../capacitor', () => ({
    isIOSNative: jest.fn(() => false),
    isNativeBridge: jest.fn(() => true),
}))

const mockIsIOSNative = isIOSNative as jest.MockedFunction<typeof isIOSNative>

describe('clipboardHasStrings', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns false off iOS without touching the plugin', async () => {
        mockIsIOSNative.mockReturnValue(false)
        await expect(clipboardHasStrings()).resolves.toBe(false)
        expect(hasStrings).not.toHaveBeenCalled()
    })

    it('returns the native answer on iOS', async () => {
        mockIsIOSNative.mockReturnValue(true)
        hasStrings.mockResolvedValue({ value: true })
        await expect(clipboardHasStrings()).resolves.toBe(true)

        hasStrings.mockResolvedValue({ value: false })
        await expect(clipboardHasStrings()).resolves.toBe(false)
    })

    it('returns false when the plugin is unavailable (older binary)', async () => {
        mockIsIOSNative.mockReturnValue(true)
        hasStrings.mockRejectedValue(new Error('"ClipboardDetect" plugin is not implemented on ios'))
        await expect(clipboardHasStrings()).resolves.toBe(false)
    })
})
