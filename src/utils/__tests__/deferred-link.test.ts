// deferred deep linking payload: the string that survives the app-store hop.
// build on web, parse back after install — the round-trip is the contract.
import {
    buildDeferredPayload,
    iosHandoffString,
    parseDeferredPayload,
    playStoreUrlWithReferrer,
    restoreDeferredContext,
    PREFERRED_LOCALE_KEY,
} from '../deferred-link'
import { isAndroidNative, isIOSNative } from '../capacitor'
import { clipboardHasStrings } from '../clipboard-detect'
import { saveToCookie } from '../general.utils'

const getReferrer = jest.fn()

jest.mock('@capacitor/core', () => ({
    registerPlugin: jest.fn(() => ({ getReferrer: () => getReferrer() })),
}))

jest.mock('../capacitor', () => ({
    isCapacitor: jest.fn(() => false),
    getPlatform: jest.fn(() => 'web'),
    isAndroidNative: jest.fn(() => false),
    isIOSNative: jest.fn(() => false),
}))

jest.mock('../clipboard-detect', () => ({
    clipboardHasStrings: jest.fn(() => Promise.resolve(false)),
}))

const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>
const mockIsIOSNative = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockClipboardHasStrings = clipboardHasStrings as jest.MockedFunction<typeof clipboardHasStrings>

const clearCookies = () => {
    for (const cookie of document.cookie.split(';')) {
        const key = cookie.trim().split('=')[0]
        if (key) document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    clearCookies()
    window.history.replaceState({}, '', '/')
})

describe('buildDeferredPayload / parseDeferredPayload round-trip', () => {
    it('round-trips a full payload including an encoded dest with query', () => {
        window.history.replaceState({}, '', '/es-419/some-page')
        saveToCookie('inviteCode', 'abc123')
        saveToCookie('campaignTag', 'offramp')

        const payload = buildDeferredPayload('/claim/XYZ?t=1')
        expect(parseDeferredPayload(payload)).toEqual({
            lang: 'es-419',
            invite: 'abc123',
            campaign: 'offramp',
            dest: '/claim/XYZ?t=1',
        })
    })

    it('defaults dest to the current path + query and skips absent fields', () => {
        window.history.replaceState({}, '', '/claim/ABC?x=2')
        const parsed = parseDeferredPayload(buildDeferredPayload())
        expect(parsed).toEqual({ dest: '/claim/ABC?x=2' })
    })

    it('omits dest for the root path and non-locale first segments', () => {
        window.history.replaceState({}, '', '/')
        expect(parseDeferredPayload(buildDeferredPayload())).toEqual({})
    })

    it('survives the play referrer url-encoding hop', () => {
        window.history.replaceState({}, '', '/pt-br/blog')
        const payload = buildDeferredPayload('/claim/XYZ?t=1')
        const url = playStoreUrlWithReferrer(payload)
        // play hands the referrer back url-decoded exactly once
        const referrer = decodeURIComponent(url.split('&referrer=')[1])
        expect(parseDeferredPayload(referrer)).toEqual({ lang: 'pt-br', dest: '/claim/XYZ?t=1' })
    })

    it('parses the full iOS hand-off url form', () => {
        const handoff = iosHandoffString('pnutdl=1&invite=test&lang=es-419&dest=%2Fhome')
        expect(handoff).toBe('https://peanut.me/?pnutdl=1&invite=test&lang=es-419&dest=%2Fhome')
        expect(parseDeferredPayload(handoff)).toEqual({ lang: 'es-419', invite: 'test', dest: '/home' })
    })
})

describe('parseDeferredPayload rejection', () => {
    it('rejects the organic play referrer', () => {
        expect(parseDeferredPayload('utm_source=google-play&utm_medium=organic')).toBeNull()
    })

    it('rejects arbitrary clipboard content', () => {
        expect(parseDeferredPayload('hello world')).toBeNull()
        expect(parseDeferredPayload('https://peanut.me/?utm_source=x')).toBeNull()
        expect(parseDeferredPayload('')).toBeNull()
    })
})

describe('restoreDeferredContext', () => {
    it('restores cookies, locale and dest from the android referrer, once', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&lang=es-419&invite=abc&campaign=off&dest=%2Fclaim%2FXYZ' })

        await expect(restoreDeferredContext()).resolves.toBe('/claim/XYZ')
        expect(document.cookie).toContain('inviteCode=')
        expect(document.cookie).toContain('campaignTag=')
        expect(localStorage.getItem(PREFERRED_LOCALE_KEY)).toBe('es-419')

        // consumed: second call never touches the plugin again
        getReferrer.mockClear()
        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(getReferrer).not.toHaveBeenCalled()
    })

    it('consumes even when nothing is found (organic install)', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'utm_source=google-play&utm_medium=organic' })

        await expect(restoreDeferredContext()).resolves.toBeNull()
        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(getReferrer).toHaveBeenCalledTimes(1)
    })

    it('does not persist an invalid locale', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&lang=xx-yy&invite=abc' })

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(localStorage.getItem(PREFERRED_LOCALE_KEY)).toBeNull()
        expect(document.cookie).toContain('inviteCode=')
    })

    it('rejects an off-origin dest', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: `pnutdl=1&dest=${encodeURIComponent('https://evil.com/x')}` })

        await expect(restoreDeferredContext()).resolves.toBeNull()
    })

    it('survives a missing plugin (older binary) and still consumes', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockRejectedValue(new Error('"InstallReferrer" plugin is not implemented on android'))

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(localStorage.getItem('deferredLinkConsumed')).toBe('1')
    })

    it('skips the iOS clipboard read when the clipboard is empty', async () => {
        mockIsAndroidNative.mockReturnValue(false)
        mockIsIOSNative.mockReturnValue(true)
        mockClipboardHasStrings.mockResolvedValue(false)

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(mockClipboardHasStrings).toHaveBeenCalledTimes(1)
        expect(localStorage.getItem('deferredLinkConsumed')).toBe('1')
    })
})
