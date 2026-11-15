const mockGetPlatform = jest.fn(() => 'ios-native')
const mockGetCachedBinaryVersion = jest.fn()
jest.mock('@/utils/capacitor', () => ({ getPlatform: () => mockGetPlatform() }))
jest.mock('@/utils/app-version', () => ({ getCachedBinaryVersion: () => mockGetCachedBinaryVersion() }))
jest.mock('@/constants/app-release', () => ({ APP_RELEASE: 'abc123' }))

import { initialSuperProperties, isAnalyticsCaptureBuild, posthogProjectKey } from '../posthog-setup'

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

describe('isAnalyticsCaptureBuild', () => {
    const keys = [
        'NEXT_PUBLIC_VERCEL_ENV',
        'NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF',
        'NEXT_PUBLIC_CAPACITOR_BUILD',
        'NEXT_PUBLIC_BASE_URL',
    ]
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    afterEach(() => {
        for (const key of keys) {
            if (saved[key] === undefined) delete process.env[key]
            else process.env[key] = saved[key]
        }
    })

    it.each([
        ['Vercel production', { NEXT_PUBLIC_VERCEL_ENV: 'production' }, true],
        [
            'staging (Vercel preview of dev)',
            { NEXT_PUBLIC_VERCEL_ENV: 'preview', NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: 'dev' },
            false,
        ],
        ['a PR preview', { NEXT_PUBLIC_VERCEL_ENV: 'preview', NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: 'fix/x' }, false],
        [
            'the production native build',
            { NEXT_PUBLIC_CAPACITOR_BUILD: 'true', NEXT_PUBLIC_BASE_URL: 'https://peanut.me' },
            true,
        ],
        [
            'the Staging-OTA native build',
            { NEXT_PUBLIC_CAPACITOR_BUILD: 'true', NEXT_PUBLIC_BASE_URL: 'https://staging.peanut.me' },
            false,
        ],
        ['a local build', {}, false],
    ])('%s captures: %p', (_name, env, expected) => {
        for (const key of keys) delete process.env[key]
        Object.assign(process.env, env)
        expect(isAnalyticsCaptureBuild()).toBe(expected)
    })
})

describe('client flag properties', () => {
    function freshSetup(): typeof import('../posthog-setup') {
        let setup: typeof import('../posthog-setup')
        jest.isolateModules(() => {
            setup = require('../posthog-setup')
        })
        return setup!
    }
    beforeEach(() => {
        mockGetPlatform.mockReturnValue('ios-native')
        mockGetCachedBinaryVersion.mockReset().mockResolvedValue('1.23.0')
    })
    afterEach(() => mockGetPlatform.mockReturnValue('ios-native'))

    it.each([
        ['android-native', 'android'],
        ['ios-native', 'ios'],
    ])('provides native properties for %s and retains the result synchronously', async (platform, expected) => {
        mockGetPlatform.mockReturnValue(platform)
        const setup = freshSetup()
        expect(setup.currentClientFlagProperties()).toBeNull()
        const props = await setup.clientFlagProperties()
        expect(props).toEqual({ client_platform: expected, binary_version: '1.23.0' })
        expect(setup.currentClientFlagProperties()).toEqual(props)
    })

    it.each(['web', 'android-pwa', 'ios-pwa'])('keeps %s web even if a native version is cached', async (platform) => {
        mockGetPlatform.mockReturnValue(platform)
        await expect(freshSetup().clientFlagProperties()).resolves.toEqual({ client_platform: 'web' })
        expect(mockGetCachedBinaryVersion).not.toHaveBeenCalled()
    })

    it.each(['android-native', 'ios-native', 'web', 'android-pwa', 'ios-pwa'])(
        'omits unavailable binary version for %s',
        async (platform) => {
            mockGetPlatform.mockReturnValue(platform)
            mockGetCachedBinaryVersion.mockResolvedValue(undefined)
            const expected = platform === 'android-native' ? 'android' : platform === 'ios-native' ? 'ios' : 'web'
            await expect(freshSetup().clientFlagProperties()).resolves.toEqual({ client_platform: expected })
        }
    )
})
