/** @jest-environment jsdom */
/**
 * migration.utils — the pwa-sunset primitives.
 *
 * isPwaSunsetOn closes web signup, so its overrides are pinned here. The
 * dev-only localStorage override is what local e2e QA rides on — a silent
 * break there blinds every future QA round.
 */

let mockFlagEnabled = false
jest.mock('@/utils/featureFlag.utils', () => ({
    isFeatureFlagEnabled: () => mockFlagEnabled,
}))

let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
    openExternalUrl: jest.fn(),
}))

// the flag override is off only on the production domain; force the dev branch for the suite's default. Getters, so
// the two cases that re-require the module under test can move them.
let mockIsDev = true
let mockBaseUrl = 'http://localhost:3000'
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    get IS_DEV() {
        return mockIsDev
    },
    get BASE_URL() {
        return mockBaseUrl
    },
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

// wiring-level mock: buildDeferredPayload's own behavior is pinned in
// deferred-link.test.ts; here we only assert openStore routes it correctly
const mockBuildPayload = jest.fn()
const mockCopyIOSHandoff = jest.fn().mockResolvedValue(undefined)
const mockTrackHandoffCreated = jest.fn()
jest.mock('@/utils/deferred-link', () => ({
    buildDeferredPayload: (...args: unknown[]) => mockBuildPayload(...args),
    playStoreUrlWithReferrer: (payload: string) => `play://listing?referrer=${encodeURIComponent(payload)}`,
    copyIOSHandoff: (...args: unknown[]) => mockCopyIOSHandoff(...args),
    trackDeferredHandoffCreated: (...args: unknown[]) => mockTrackHandoffCreated(...args),
}))

import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { openExternalUrl } from '@/utils/capacitor'
import { isPwaSunsetOn, openStore, storeAnchorHref, storeForDevice, storeIcon } from '@/utils/migration.utils'
import { DeviceType } from '@/hooks/useGetDeviceType'

const mockOpenExternalUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>

beforeEach(() => {
    localStorage.clear()
    mockFlagEnabled = false
    mockIsCapacitor = false
    delete process.env.NEXT_PUBLIC_VERCEL_ENV
    delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF
})

describe('isPwaSunsetOn', () => {
    it('fails closed by default', () => {
        expect(isPwaSunsetOn()).toBe(false)
    })

    it('follows the posthog flag', () => {
        mockFlagEnabled = true
        expect(isPwaSunsetOn()).toBe(true)
    })

    it('keeps web signup enabled on ad-hoc Vercel PR previews', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'feat/review-this-change'
        mockFlagEnabled = true

        expect(isPwaSunsetOn()).toBe(false)
    })

    it('keeps web signup enabled on the dev branch staging deployment', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'dev'
        mockFlagEnabled = true

        expect(isPwaSunsetOn()).toBe(false)
    })

    it('localStorage override still turns it on for a Vercel preview deployment', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'dev'
        localStorage.setItem('pwa-sunset', 'true')

        expect(isPwaSunsetOn()).toBe(true)
    })

    it('does not mistake local preview-mode fixture builds for Vercel PR previews', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        mockFlagEnabled = true

        expect(isPwaSunsetOn()).toBe(true)
    })

    it('dev localStorage override turns it on without posthog', () => {
        localStorage.setItem('pwa-sunset', 'true')
        expect(isPwaSunsetOn()).toBe(true)
    })

    /*
     * The e2e layout gate runs against `next start`, where NODE_ENV is
     * 'production' and no posthog key is configured — so a dev-only override
     * left every "flag on" case measuring the flag-off page. The override is
     * scoped to the domain instead, and peanut.me still answers to posthog.
     */
    it.each([
        ['a preview or CI build honours the override', 'http://127.0.0.1:3080', true],
        ['the production domain ignores it', 'https://peanut.me', false],
    ])('production build: %s', (_label, baseUrl, expected) => {
        mockIsDev = false
        mockBaseUrl = baseUrl
        localStorage.setItem('pwa-sunset', 'true')
        try {
            jest.isolateModules(() => {
                // IS_PROD_DOMAIN is computed at module load, so re-require it
                const fresh = require('@/utils/migration.utils') as typeof import('@/utils/migration.utils')
                expect(fresh.isPwaSunsetOn()).toBe(expected)
            })
        } finally {
            mockIsDev = true
            mockBaseUrl = 'http://localhost:3000'
        }
    })

    it('ignores non-"true" override values', () => {
        localStorage.setItem('pwa-sunset', 'false')
        expect(isPwaSunsetOn()).toBe(false)
    })
})

describe('storeForDevice / storeIcon', () => {
    it.each([
        [DeviceType.IOS, 'ios', 'apple-logo'],
        [DeviceType.ANDROID, 'android', 'google-play'],
        [DeviceType.WEB, null, 'qr-code'],
    ] as const)('%s downloads from %s with the %s icon', (device, store, icon) => {
        expect(storeForDevice(device)).toBe(store)
        expect(storeIcon(storeForDevice(device))).toBe(icon)
    })
})

describe('openStore deferred hand-off', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockBuildPayload.mockReturnValue('pnutdl=1&dest=%2Fclaim%2FXYZ')
    })

    it('android rides the payload on the play install referrer', () => {
        openStore('android', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(
            `play://listing?referrer=${encodeURIComponent('pnutdl=1&dest=%2Fclaim%2FXYZ')}`
        )
        expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
    })

    it('ios copies the hand-off then opens the plain store url', () => {
        openStore('ios', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockBuildPayload).toHaveBeenCalledWith(undefined, undefined, 'ios')
        expect(mockCopyIOSHandoff).toHaveBeenCalledWith('pnutdl=1&dest=%2Fclaim%2FXYZ')
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('passes surface-known invite + dest through to the payload builder', () => {
        openStore('android', MIGRATION_SURFACES.GUEST_FLOW, { invite: 'sender', dest: '/claim/ABC?t=1' })
        expect(mockBuildPayload).toHaveBeenCalledWith('/claim/ABC?t=1', 'sender', 'android')
    })

    it('a payload failure never blocks the store bounce', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no window')
        })
        openStore('android', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.android)
    })

    it('the native app opens the store with no hand-off', () => {
        mockIsCapacitor = true
        openStore('ios', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockBuildPayload).not.toHaveBeenCalled()
        expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.ios)
    })

    // the denominator for DEFERRED_LINK_RESTORED: one event per hand-off
    // actually written inside a store-bounce tap
    it('a written android hand-off counts as created', () => {
        openStore('android', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockTrackHandoffCreated).toHaveBeenCalledTimes(1)
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('android')
    })

    it('an ios hand-off counts only after the clipboard write resolves', async () => {
        let resolveCopy!: () => void
        mockCopyIOSHandoff.mockReturnValue(new Promise<void>((r) => (resolveCopy = r)))
        openStore('ios', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockTrackHandoffCreated).not.toHaveBeenCalled()
        resolveCopy()
        await Promise.resolve()
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('ios')
    })

    it('a declined/failed ios clipboard write is not counted', async () => {
        mockCopyIOSHandoff.mockRejectedValue(new Error('denied'))
        openStore('ios', MIGRATION_SURFACES.GUEST_FLOW)
        await Promise.resolve()
        await Promise.resolve()
        expect(mockTrackHandoffCreated).not.toHaveBeenCalled()
    })

    it('no payload, no created event', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no window')
        })
        openStore('android', MIGRATION_SURFACES.GUEST_FLOW)
        expect(mockTrackHandoffCreated).not.toHaveBeenCalled()
    })
})

describe('store anchor helpers (self-navigating CTAs)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockBuildPayload.mockReturnValue('pnutdl=1')
    })

    it('android anchor href carries the referrer payload', () => {
        expect(storeAnchorHref('android')).toBe(`play://listing?referrer=${encodeURIComponent('pnutdl=1')}`)
    })

    it('ios anchor href stays bare', () => {
        expect(storeAnchorHref('ios')).toBe(STORE_URL.ios)
    })

    it('a payload failure falls back to the bare store url', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no window')
        })
        expect(storeAnchorHref('android')).toBe(STORE_URL.android)
    })
})
