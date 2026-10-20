jest.mock('@/utils/capacitor', () => ({ getPlatform: () => 'ios-native' }))
jest.mock('@/constants/app-release', () => ({ APP_RELEASE: 'abc123' }))

import { initialSuperProperties, posthogProjectKey } from '../posthog-setup'

describe('posthogProjectKey', () => {
    const original = process.env.NEXT_PUBLIC_POSTHOG_KEY
    afterEach(() => {
        process.env.NEXT_PUBLIC_POSTHOG_KEY = original
    })

    it('returns the key this build was given', () => {
        process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_staging'
        expect(posthogProjectKey()).toBe('phc_staging')
    })

    it.each([undefined, '', '   '])('turns PostHog off for an empty key (%p)', (value) => {
        if (value === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
        else process.env.NEXT_PUBLIC_POSTHOG_KEY = value
        expect(posthogProjectKey()).toBeNull()
    })
})

describe('initialSuperProperties', () => {
    it('carries platform, so the first $pageview of a new visitor has it', () => {
        expect(initialSuperProperties()).toEqual({ app_release: 'abc123', platform: 'ios-native' })
    })
})
