/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * migration.utils — the app-download primitives, and the build gate for the
 * test-build web sign-up.
 */

let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
    openExternalUrl: jest.fn(),
}))

// getters, so the TEST_WEB_SIGNUP cases that re-require the constants can move them
let mockIsDev = false
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
import { onStoreAnchorClick, openStore, storeAnchorHref, storeForDevice, storeIcon } from '@/utils/migration.utils'
import { DeviceType } from '@/hooks/useGetDeviceType'

const mockOpenExternalUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>

beforeEach(() => {
    localStorage.clear()
    mockIsCapacitor = false
})

describe('TEST_WEB_SIGNUP', () => {
    // read at module load, so each build re-requires the constants
    function onBuild(baseUrl: string, isDev = false): boolean {
        mockBaseUrl = baseUrl
        mockIsDev = isDev
        let value = false
        jest.isolateModules(() => {
            value = require('@/constants/migration.consts').TEST_WEB_SIGNUP
        })
        mockBaseUrl = 'http://localhost:3000'
        mockIsDev = false
        return value
    }

    it('never shows the test sign-up on peanut.me', () => {
        expect(onBuild('https://peanut.me')).toBe(false)
    })

    it('shows it under next dev, where an unset base URL falls back to peanut.me', () => {
        expect(onBuild('https://peanut.me', true)).toBe(true)
    })

    it.each([
        'https://staging.peanut.me',
        'https://peanut-wallet-git-x-squirrellabs.vercel.app',
        'http://localhost:3000',
    ])('shows it on %s', (baseUrl) => {
        expect(onBuild(baseUrl)).toBe(true)
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

    it('ios anchor href stays bare — the clipboard rides on click instead', () => {
        expect(storeAnchorHref('ios')).toBe(STORE_URL.ios)
        onStoreAnchorClick('ios', MIGRATION_SURFACES.LANDING_HERO)
        expect(mockCopyIOSHandoff).toHaveBeenCalledWith('pnutdl=1')
    })

    it('android click only tracks — the href already carries the payload', () => {
        onStoreAnchorClick('android', MIGRATION_SURFACES.LANDING_HERO)
        expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('android')
    })

    it('ios anchor click counts the hand-off once the clipboard write resolves', async () => {
        mockCopyIOSHandoff.mockResolvedValue(undefined)
        onStoreAnchorClick('ios', MIGRATION_SURFACES.LANDING_HERO)
        await Promise.resolve()
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('ios')
    })

    it('a payload failure falls back to the bare store url', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no window')
        })
        expect(storeAnchorHref('android')).toBe(STORE_URL.android)
    })
})
