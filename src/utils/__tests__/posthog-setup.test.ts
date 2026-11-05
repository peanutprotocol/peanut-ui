jest.mock('@/utils/capacitor', () => ({ getPlatform: () => 'ios-native' }))
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
