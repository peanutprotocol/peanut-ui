// deferred deep linking payload: the string that survives the app-store hop.
// build on web, parse back after install — the round-trip is the contract.
import {
    applyDeferredPayload,
    buildDeferredPayload,
    iosHandoffString,
    parseDeferredPayload,
    playStoreUrlWithReferrer,
    restoreDeferredContext,
    APP_LOCALE_KEY,
} from '../deferred-link'
import { isAndroidNative, isIOSNative } from '../capacitor'
import { clipboardHasStrings, clipboardHasProbableWebUrl } from '../clipboard-detect'
import { saveToCookie } from '../general.utils'

const getReferrer = jest.fn()

jest.mock('@capacitor/core', () => ({
    registerPlugin: jest.fn(() => ({ getReferrer: () => getReferrer() })),
}))

jest.mock('../general.utils', () => {
    const actual = jest.requireActual('../general.utils')
    return { ...actual, saveToCookie: jest.fn(actual.saveToCookie) }
})

jest.mock('../capacitor', () => ({
    isCapacitor: jest.fn(() => false),
    getPlatform: jest.fn(() => 'web'),
    isAndroidNative: jest.fn(() => false),
    isIOSNative: jest.fn(() => false),
}))

jest.mock('../clipboard-detect', () => ({
    clipboardHasStrings: jest.fn(() => Promise.resolve(false)),
    clipboardHasProbableWebUrl: jest.fn(() => Promise.resolve(false)),
}))

const clipboardRead = jest.fn()
const clipboardWrite = jest.fn()
jest.mock('@capacitor/clipboard', () => ({
    Clipboard: { read: () => clipboardRead(), write: (o: unknown) => clipboardWrite(o) },
}))

const preferencesSet = jest.fn(async (_o: unknown) => {})
jest.mock('@capacitor/preferences', () => ({
    Preferences: { set: (o: unknown) => preferencesSet(o) },
}))

const posthogCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: (...args: unknown[]) => posthogCapture(...args),
    },
}))

const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>
const mockIsIOSNative = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockClipboardHasStrings = clipboardHasStrings as jest.MockedFunction<typeof clipboardHasStrings>
const mockClipboardHasProbableWebUrl = clipboardHasProbableWebUrl as jest.MockedFunction<
    typeof clipboardHasProbableWebUrl
>
const mockSaveToCookie = saveToCookie as jest.MockedFunction<typeof saveToCookie>

const clearCookies = () => {
    for (const cookie of document.cookie.split(';')) {
        const key = cookie.trim().split('=')[0]
        if (key) document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockIsAndroidNative.mockReturnValue(false)
    mockIsIOSNative.mockReturnValue(false)
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

    it('strips the locale prefix from the default dest but keeps it as lang', () => {
        window.history.replaceState({}, '', '/es-419/claim/ABC?x=2')
        expect(parseDeferredPayload(buildDeferredPayload())).toEqual({ lang: 'es-419', dest: '/claim/ABC?x=2' })
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

describe('applyDeferredPayload', () => {
    it('writes durable 30-day cookies, not session cookies', () => {
        applyDeferredPayload({ invite: 'abc', campaign: 'off' })
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'abc', 30)
        expect(mockSaveToCookie).toHaveBeenCalledWith('campaignTag', 'off', 30)
    })

    it('normalizes invite and campaign like the existing writers', () => {
        applyDeferredPayload({ invite: ' @Alice ', campaign: ' OFFRAMP ' })
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'alice', 30)
        expect(mockSaveToCookie).toHaveBeenCalledWith('campaignTag', 'offramp', 30)
    })

    it('strips the marketing locale prefix from dest (native export has no /{locale} routes)', () => {
        expect(applyDeferredPayload({ dest: '/es-419/claim/XYZ?t=1' }).dest).toBe('/claim/XYZ?t=1')
        expect(applyDeferredPayload({ dest: '/pt-br/home' }).dest).toBe('/home')
        expect(applyDeferredPayload({ dest: '/claim/XYZ' }).dest).toBe('/claim/XYZ')
    })

    it('normalizes and persists supported locales under the app-locale key', async () => {
        expect(applyDeferredPayload({ lang: 'pt-br' }).locale).toBe('pt-BR')
        expect(applyDeferredPayload({ lang: 'es-ar' }).locale).toBe('es-419')
        expect(applyDeferredPayload({ lang: 'es-419' }).locale).toBe('es-419')
        expect(applyDeferredPayload({ lang: 'en' }).locale).toBe('en')
        expect(localStorage.getItem(APP_LOCALE_KEY)).toBe('en')
        // native persistence is fire-and-forget via @capacitor/preferences —
        // flush the dynamic-import microtask chain before asserting
        await new Promise((r) => setTimeout(r, 0))
        expect(preferencesSet).toHaveBeenCalledWith({ key: APP_LOCALE_KEY, value: 'en' })
    })

    it('returns null locale for unsupported languages and does not persist', () => {
        expect(applyDeferredPayload({ lang: 'fr' }).locale).toBeNull()
        expect(applyDeferredPayload({ lang: 'xx-yy' }).locale).toBeNull()
        expect(applyDeferredPayload({}).locale).toBeNull()
        expect(localStorage.getItem(APP_LOCALE_KEY)).toBeNull()
    })
})

describe('restoreDeferredContext', () => {
    it('restores cookies, locale and dest from the android referrer, once', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&lang=es-419&invite=abc&campaign=off&dest=%2Fclaim%2FXYZ' })

        await expect(restoreDeferredContext()).resolves.toEqual({ dest: '/claim/XYZ', locale: 'es-419' })
        expect(document.cookie).toContain('inviteCode=')
        expect(document.cookie).toContain('campaignTag=')
        expect(localStorage.getItem(APP_LOCALE_KEY)).toBe('es-419')

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

    it('rejects an off-origin dest', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: `pnutdl=1&dest=${encodeURIComponent('https://evil.com/x')}` })

        await expect(restoreDeferredContext()).resolves.toEqual({ dest: null, locale: null })
    })

    it('survives a missing plugin (older binary) and still consumes', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockRejectedValue(new Error('"InstallReferrer" plugin is not implemented on android'))

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(localStorage.getItem('deferredLinkConsumed')).toBe('1')
    })

    it('overlapping calls share one platform read', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&dest=%2Fhome' })

        const [a, b] = await Promise.all([restoreDeferredContext(), restoreDeferredContext()])
        expect(getReferrer).toHaveBeenCalledTimes(1)
        expect(a).toEqual(b)
    })

    it('skips the iOS clipboard read when the clipboard is empty', async () => {
        mockIsIOSNative.mockReturnValue(true)
        mockClipboardHasStrings.mockResolvedValue(false)

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(mockClipboardHasStrings).toHaveBeenCalledTimes(1)
        expect(clipboardRead).not.toHaveBeenCalled()
        expect(localStorage.getItem('deferredLinkConsumed')).toBe('1')
    })

    it('never prompts for clipboard text that is not a probable web url', async () => {
        mockIsIOSNative.mockReturnValue(true)
        mockClipboardHasStrings.mockResolvedValue(true)
        mockClipboardHasProbableWebUrl.mockResolvedValue(false)

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(clipboardRead).not.toHaveBeenCalled()
    })

    it('restores from the iOS hand-off url and clears the clipboard after', async () => {
        mockIsIOSNative.mockReturnValue(true)
        mockClipboardHasStrings.mockResolvedValue(true)
        mockClipboardHasProbableWebUrl.mockResolvedValue(true)
        clipboardRead.mockResolvedValue({ value: 'https://peanut.me/?pnutdl=1&invite=test&dest=%2Fhome' })
        clipboardWrite.mockResolvedValue(undefined)

        await expect(restoreDeferredContext()).resolves.toEqual({ dest: '/home', locale: null })
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'test', 30)
        expect(clipboardWrite).toHaveBeenCalled()
    })
})

// The point of these: an empty clipboard and a declined paste prompt both yield
// no payload, so without distinct outcomes a hand-off that never works is
// indistinguishable from one nobody used.
describe('restore telemetry', () => {
    const lastRestoreEvent = () =>
        posthogCapture.mock.calls.filter((c) => c[0] === 'deferred_link_restored').at(-1)?.[1]

    it('reports a successful restore with which fields came back, and no payload content', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&lang=pt-BR&invite=abc&dest=%2Fhome' })

        await restoreDeferredContext()

        expect(lastRestoreEvent()).toEqual({
            channel: 'referrer',
            outcome: 'restored',
            has_dest: true,
            has_locale: true,
            has_invite: true,
            has_campaign: false,
        })
        // the inviter and destination must never reach analytics
        expect(JSON.stringify(posthogCapture.mock.calls)).not.toContain('abc')
        expect(JSON.stringify(posthogCapture.mock.calls)).not.toContain('/home')
    })

    it('separates an organic install from a declined iOS paste prompt', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: null })
        await restoreDeferredContext()
        expect(lastRestoreEvent()).toEqual({ channel: 'referrer', outcome: 'no_handoff' })

        posthogCapture.mockClear()
        localStorage.clear()
        mockIsAndroidNative.mockReturnValue(false)
        mockIsIOSNative.mockReturnValue(true)
        mockClipboardHasStrings.mockResolvedValue(true)
        mockClipboardHasProbableWebUrl.mockResolvedValue(true)
        clipboardRead.mockRejectedValue(new Error('user declined'))

        await restoreDeferredContext()
        expect(lastRestoreEvent()).toEqual({ channel: 'clipboard', outcome: 'clipboard_unavailable' })
    })

    it('reports a present-but-unmarked referrer as marker_missing, not no_handoff', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'utm_source=google-play&utm_medium=organic' })

        await restoreDeferredContext()
        expect(lastRestoreEvent()).toEqual({ channel: 'referrer', outcome: 'marker_missing' })
    })

    it('does not lose the restored context when posthog throws', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&dest=%2Fhome' })
        posthogCapture.mockImplementation(() => {
            throw new Error('posthog not initialised')
        })

        await expect(restoreDeferredContext()).resolves.toEqual({ dest: '/home', locale: null })
    })
})
