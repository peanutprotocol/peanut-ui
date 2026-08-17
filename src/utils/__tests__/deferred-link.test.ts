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
            badgeCampaigns: ['offramp'],
            dest: '/claim/XYZ?t=1',
        })
    })

    it('round-trips repeated badge campaign identities without comma encoding or case loss', () => {
        saveToCookie('campaignTag', ['Creator/Summer', 'Tag,With,Commas'])

        const payload = buildDeferredPayload('/home')
        const payloadParams = new URLSearchParams(payload)
        expect(payloadParams.getAll('badge_campaign')).toEqual(['Creator/Summer', 'Tag,With,Commas'])
        expect(payloadParams.has('campaign')).toBe(false)
        expect(parseDeferredPayload(payload)).toEqual({
            badgeCampaigns: ['Creator/Summer', 'Tag,With,Commas'],
            dest: '/home',
        })
    })

    it('accepts old deferred campaign payloads while preferring the canonical namespace', () => {
        expect(parseDeferredPayload('pnutdl=1&campaign=legacy-first&campaign=legacy-second')).toEqual({
            badgeCampaigns: ['legacy-first', 'legacy-second'],
        })
        expect(
            parseDeferredPayload(
                'pnutdl=1&utm_campaign=analytics&campaign=legacy&badge_campaign=canonical-first&badge_campaign=canonical-second'
            )
        ).toEqual({ badgeCampaigns: ['canonical-first', 'canonical-second'] })
    })

    it('keeps a marked historical UTM source-qualified for backend allowlist resolution', () => {
        expect(parseDeferredPayload('pnutdl=1&utm_campaign=token-nation-2026')).toEqual({
            badgeCampaigns: ['utm:token-nation-2026'],
        })
    })

    it('round-trips the maximum-length source-qualified UTM identity through install handoff', () => {
        const qualifiedUtmIdentity = `utm:${'x'.repeat(64)}`
        saveToCookie('campaignTag', qualifiedUtmIdentity)

        expect(parseDeferredPayload(buildDeferredPayload('/home'))).toEqual({
            badgeCampaigns: [qualifiedUtmIdentity],
            dest: '/home',
        })
    })

    it('invite argument overrides the cookie (claim CTA knows the code pre-cookie)', () => {
        saveToCookie('inviteCode', 'cookiecode')
        expect(parseDeferredPayload(buildDeferredPayload('/home', 'sendercode'))).toEqual({
            invite: 'sendercode',
            dest: '/home',
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

    it('omits the default dest when the page url carries a claim secret (#p=)', () => {
        window.history.replaceState({}, '', '/claim?c=42161&i=99')
        window.location.hash = '#p=s3cr3t'
        expect(parseDeferredPayload(buildDeferredPayload())).toEqual({})
        // an explicit dest still rides — only the default is suppressed
        expect(parseDeferredPayload(buildDeferredPayload('/home'))).toEqual({ dest: '/home' })
        window.location.hash = ''
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
    it('writes a SESSION inviteCode cookie and a 30-day campaign list', () => {
        applyDeferredPayload({ invite: 'abc', campaign: 'off' })
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'abc')
        expect(mockSaveToCookie).toHaveBeenCalledWith('campaignTag', 'off', 30)
    })

    it('normalizes invite separately while preserving campaign spelling after outer trim', () => {
        applyDeferredPayload({ invite: ' @Alice ', campaign: ' OFFRAMP ' })
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'alice')
        expect(mockSaveToCookie).toHaveBeenCalledWith('campaignTag', 'OFFRAMP', 30)
    })

    it('strips the marketing locale prefix from dest (native export has no /{locale} routes)', () => {
        expect(applyDeferredPayload({ dest: '/es-419/claim/XYZ?t=1' }).dest).toBe('/claim/XYZ?t=1')
        expect(applyDeferredPayload({ dest: '/pt-br/home' }).dest).toBe('/home')
        expect(applyDeferredPayload({ dest: '/claim/XYZ' }).dest).toBe('/claim/XYZ')
        // locale with only a query after it
        expect(applyDeferredPayload({ dest: '/pt-br?x=1' }).dest).toBe('/?x=1')
    })

    it('drops an unmappable dest instead of pushing it verbatim', () => {
        // stray % makes decodeURIComponent throw inside deepLinkToNativePath
        expect(applyDeferredPayload({ dest: '/send/50%' }).dest).toBeNull()
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
        getReferrer.mockResolvedValue({
            referrer: 'pnutdl=1&lang=es-419&invite=abc&badge_campaign=off&dest=%2Fclaim%2FXYZ',
        })

        await expect(restoreDeferredContext()).resolves.toEqual({ dest: '/claim/XYZ', locale: 'es-419' })
        expect(document.cookie).toContain('inviteCode=')
        expect(document.cookie).toContain('campaignTag=')
        expect(localStorage.getItem(APP_LOCALE_KEY)).toBe('es-419')

        // consumed: second call never touches the plugin again
        getReferrer.mockClear()
        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(getReferrer).not.toHaveBeenCalled()
    })

    it('does NOT consume on a transient android read failure — next launch retries', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        // timeout / SERVICE_UNAVAILABLE path: plugin resolves {referrer: null}
        getReferrer.mockResolvedValue({ referrer: null })

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(localStorage.getItem('deferredLinkConsumed')).toBeNull()

        // "next launch": the read now succeeds and the payload still lands
        getReferrer.mockResolvedValue({ referrer: 'pnutdl=1&dest=%2Fhome' })
        await expect(restoreDeferredContext()).resolves.toEqual({ dest: '/home', locale: null })
        expect(localStorage.getItem('deferredLinkConsumed')).toBe('1')
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

    it('survives a missing plugin (older binary) without consuming — the retry is a single cheap no-op per launch', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        getReferrer.mockRejectedValue(new Error('"InstallReferrer" plugin is not implemented on android'))

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(localStorage.getItem('deferredLinkConsumed')).toBeNull()
    })

    it('iOS: consumes BEFORE the paste prompt so kill-during-prompt never re-prompts', async () => {
        mockIsIOSNative.mockReturnValue(true)
        mockClipboardHasStrings.mockResolvedValue(true)
        mockClipboardHasProbableWebUrl.mockResolvedValue(true)
        // user declined the prompt (or killed the app — read never resolves ok)
        clipboardRead.mockRejectedValue(new Error('denied'))

        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(localStorage.getItem('deferredLinkConsumed')).toBe('1')

        // next launch: no clipboard access at all
        mockClipboardHasStrings.mockClear()
        await expect(restoreDeferredContext()).resolves.toBeNull()
        expect(mockClipboardHasStrings).not.toHaveBeenCalled()
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
        expect(mockSaveToCookie).toHaveBeenCalledWith('inviteCode', 'test')
        expect(clipboardWrite).toHaveBeenCalled()
    })
})
