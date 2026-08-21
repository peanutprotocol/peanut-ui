/** @jest-environment jsdom */
/**
 * migration.utils — the pwa-sunset primitives.
 *
 * shouldShowSunsetBlock is the single predicate that can make the whole app
 * inaccessible (three call sites: both layouts + implicitly /app's flag gate),
 * so its matrix is pinned here. The dev-only localStorage overrides are what
 * local e2e QA rides on — a silent break there blinds every future QA round.
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

// the localStorage overrides are dev-only; force the dev branch in tests
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    IS_DEV: true,
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

// wiring-level mock: buildDeferredPayload's own behavior is pinned in
// deferred-link.test.ts; here we only assert openStore routes it correctly
const mockBuildPayload = jest.fn()
const mockCopyIOSHandoff = jest.fn().mockResolvedValue(undefined)
jest.mock('@/utils/deferred-link', () => ({
    buildDeferredPayload: (...args: unknown[]) => mockBuildPayload(...args),
    playStoreUrlWithReferrer: (payload: string) => `play://listing?referrer=${encodeURIComponent(payload)}`,
    copyIOSHandoff: (...args: unknown[]) => mockCopyIOSHandoff(...args),
}))

import { MIGRATION_CUTOVER_DATE, MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { openExternalUrl } from '@/utils/capacitor'
import {
    getMigrationCutoverTime,
    isPwaSunsetOn,
    onStoreAnchorClick,
    openStore,
    shouldShowSunsetBlock,
    storeAnchorHref,
} from '@/utils/migration.utils'

const mockOpenExternalUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>

const CUTOVER = MIGRATION_CUTOVER_DATE.getTime()
const AFTER = CUTOVER + 1000
const BEFORE = CUTOVER - 1000

beforeEach(() => {
    localStorage.clear()
    mockFlagEnabled = false
    mockIsCapacitor = false
})

describe('isPwaSunsetOn', () => {
    it('fails closed by default', () => {
        expect(isPwaSunsetOn()).toBe(false)
    })

    it('follows the posthog flag', () => {
        mockFlagEnabled = true
        expect(isPwaSunsetOn()).toBe(true)
    })

    it('dev localStorage override turns it on without posthog', () => {
        localStorage.setItem('pwa-sunset', 'true')
        expect(isPwaSunsetOn()).toBe(true)
    })

    it('ignores non-"true" override values', () => {
        localStorage.setItem('pwa-sunset', 'false')
        expect(isPwaSunsetOn()).toBe(false)
    })
})

describe('getMigrationCutoverTime', () => {
    it('returns the constant by default', () => {
        expect(getMigrationCutoverTime()).toBe(CUTOVER)
    })

    it('dev localStorage override moves the cutover', () => {
        localStorage.setItem('pwa-sunset-cutover', '2020-01-01')
        expect(getMigrationCutoverTime()).toBe(new Date('2020-01-01').getTime())
    })

    it('garbage override falls back to the constant', () => {
        localStorage.setItem('pwa-sunset-cutover', 'not-a-date')
        expect(getMigrationCutoverTime()).toBe(CUTOVER)
    })
})

describe('shouldShowSunsetBlock', () => {
    const base = { migrationOn: true, hasKeepWebBypass: false, now: AFTER }

    it('blocks past the cutover with the flag on', () => {
        expect(shouldShowSunsetBlock(base)).toBe(true)
    })

    it('never blocks with the flag off', () => {
        expect(shouldShowSunsetBlock({ ...base, migrationOn: false })).toBe(false)
    })

    it('never blocks before the cutover (notice window)', () => {
        expect(shouldShowSunsetBlock({ ...base, now: BEFORE })).toBe(false)
    })

    it('public guest paths pass through', () => {
        expect(shouldShowSunsetBlock({ ...base, isPublic: true })).toBe(false)
    })

    it('the native app is never blocked', () => {
        mockIsCapacitor = true
        expect(shouldShowSunsetBlock(base)).toBe(false)
    })

    it('the keep-web support bypass passes through', () => {
        expect(shouldShowSunsetBlock({ ...base, hasKeepWebBypass: true })).toBe(false)
    })

    it('respects the dev cutover override', () => {
        localStorage.setItem('pwa-sunset-cutover', '2020-01-01')
        expect(shouldShowSunsetBlock({ ...base, now: BEFORE })).toBe(true)
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
        expect(mockCopyIOSHandoff).toHaveBeenCalledWith('pnutdl=1&dest=%2Fclaim%2FXYZ')
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('passes surface-known invite + dest through to the payload builder', () => {
        openStore('android', MIGRATION_SURFACES.GUEST_FLOW, { invite: 'sender', dest: '/claim/ABC?t=1' })
        expect(mockBuildPayload).toHaveBeenCalledWith('/claim/ABC?t=1', 'sender')
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
    })

    it('a payload failure falls back to the bare store url', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no window')
        })
        expect(storeAnchorHref('android')).toBe(STORE_URL.android)
    })
})
