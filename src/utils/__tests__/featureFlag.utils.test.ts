/**
 * featureFlag.utils — a flag PostHog has not answered reads as its registered
 * safe default, never as a blanket false.
 */

// posthog-js returns `options.defaultValue` when it has no value for the key
let mockAnswers: Record<string, boolean> = {}
const mockIsFeatureEnabled = jest.fn((key: string, options?: { defaultValue?: boolean }) =>
    key in mockAnswers ? mockAnswers[key] : options?.defaultValue
)
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        isFeatureEnabled: (key: string, options?: { defaultValue?: boolean }) => mockIsFeatureEnabled(key, options),
    },
}))

let mockBaseUrl = 'https://peanut.me'
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    get BASE_URL() {
        return mockBaseUrl
    },
}))

import { FLAG_DEFAULTS, isFeatureFlagEnabled, type FeatureFlagKey } from '@/utils/featureFlag.utils'

const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FeatureFlagKey[]

beforeEach(() => {
    mockAnswers = {}
    mockIsFeatureEnabled.mockClear()
})

describe('isFeatureFlagEnabled', () => {
    it.each(FLAG_KEYS)('reads unanswered %s as its registered default', (key) => {
        expect(isFeatureFlagEnabled(key)).toBe(FLAG_DEFAULTS[key])
        expect(mockIsFeatureEnabled).toHaveBeenCalledWith(key, { defaultValue: FLAG_DEFAULTS[key] })
    })

    it.each([true, false])('returns the PostHog answer %s over the default', (answer) => {
        mockAnswers = { 'user-interviews-invite': answer }
        expect(isFeatureFlagEnabled('user-interviews-invite')).toBe(answer)
    })

    it('nonProdBypass turns the flag on outside peanut.me without asking PostHog', () => {
        mockBaseUrl = 'https://staging.peanut.me'
        try {
            jest.isolateModules(() => {
                const fresh = require('@/utils/featureFlag.utils') as typeof import('@/utils/featureFlag.utils')
                expect(fresh.isFeatureFlagEnabled('user-interviews-invite', { nonProdBypass: true })).toBe(true)
            })
            expect(mockIsFeatureEnabled).not.toHaveBeenCalled()
        } finally {
            mockBaseUrl = 'https://peanut.me'
        }
    })

    it('nonProdBypass does not apply on peanut.me', () => {
        mockAnswers = { 'user-interviews-invite': false }
        expect(isFeatureFlagEnabled('user-interviews-invite', { nonProdBypass: true })).toBe(false)
    })

    it('a key outside the registry is a type error', () => {
        // @ts-expect-error every flag needs a FLAG_DEFAULTS entry
        expect(() => isFeatureFlagEnabled('not-a-registered-flag')).not.toThrow()
    })
})
