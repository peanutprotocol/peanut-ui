const ORIGINAL = { ...process.env }

afterEach(() => {
    process.env = { ...ORIGINAL }
    jest.resetModules()
})

async function resolveOrigin() {
    const { statusFeedOrigin } = await import('./feed')
    return statusFeedOrigin()
}

describe('statusFeedOrigin', () => {
    // The page reports the system users are on, not the one it happens to be
    // deployed beside — staging health under a production banner is worse
    // than showing nothing.
    it.each(['preview', 'development', 'production', undefined])(
        'reads the production API when VERCEL_ENV is %s',
        async (vercelEnv) => {
            delete process.env.STATUS_API_URL
            delete process.env.PEANUT_API_URL
            delete process.env.NEXT_PUBLIC_PEANUT_API_URL
            delete process.env.NEXT_PUBLIC_VERCEL_ENV
            if (vercelEnv) process.env.VERCEL_ENV = vercelEnv
            else delete process.env.VERCEL_ENV

            expect(await resolveOrigin()).toBe('https://api.peanut.me')
        }
    )

    it('does not follow the app API, which differs per environment', async () => {
        delete process.env.STATUS_API_URL
        process.env.PEANUT_API_URL = 'https://api.staging.peanut.me'
        expect(await resolveOrigin()).toBe('https://api.peanut.me')
    })

    it('lets STATUS_API_URL override, trailing slash trimmed', async () => {
        process.env.VERCEL_ENV = 'preview'
        process.env.STATUS_API_URL = 'https://api.example.test/'
        expect(await resolveOrigin()).toBe('https://api.example.test')
    })
})
