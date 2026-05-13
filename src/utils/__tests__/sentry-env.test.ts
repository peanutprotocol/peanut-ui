import { inferSentryEnvironment } from '../sentry-env'

describe('inferSentryEnvironment', () => {
    const originalEnv = process.env

    beforeEach(() => {
        process.env = { ...originalEnv }
        delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        delete process.env.NEXT_PUBLIC_VERCEL_ENV
        delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF
    })

    afterAll(() => {
        process.env = originalEnv
    })

    it('returns "native" when Capacitor build flag is set', () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'production' // should be ignored
        expect(inferSentryEnvironment()).toBe('native')
    })

    it('returns "production" on Vercel production deploys', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
        expect(inferSentryEnvironment()).toBe('production')
    })

    it('returns "staging" on preview deploys of the dev branch', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'dev'
        expect(inferSentryEnvironment()).toBe('staging')
    })

    it('returns "preview" on ad-hoc PR preview deploys', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = 'feat/some-pr'
        expect(inferSentryEnvironment()).toBe('preview')
    })

    it('returns "preview" when branch is unknown on a preview build', () => {
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        expect(inferSentryEnvironment()).toBe('preview')
    })

    it('returns "development" when no Vercel env is set (local)', () => {
        expect(inferSentryEnvironment()).toBe('development')
    })
})
