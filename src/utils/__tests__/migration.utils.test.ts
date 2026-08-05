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

import { MIGRATION_CUTOVER_DATE } from '@/constants/migration.consts'
import { getMigrationCutoverTime, isPwaSunsetOn, shouldShowSunsetBlock } from '@/utils/migration.utils'

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
