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
    it('reads staging on preview deployments, where prod has not shipped the feed yet', async () => {
        process.env.VERCEL_ENV = 'preview'
        delete process.env.STATUS_API_URL
        expect(await resolveOrigin()).toBe('https://api.staging.peanut.me')
    })

    it('falls back to the client-exposed copy of VERCEL_ENV', async () => {
        delete process.env.VERCEL_ENV
        delete process.env.STATUS_API_URL
        process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
        expect(await resolveOrigin()).toBe('https://api.staging.peanut.me')
    })

    it('uses the app API in production', async () => {
        process.env.VERCEL_ENV = 'production'
        delete process.env.STATUS_API_URL
        delete process.env.PEANUT_API_URL
        delete process.env.NEXT_PUBLIC_PEANUT_API_URL
        expect(await resolveOrigin()).toBe('https://api.peanut.me')
    })

    it('lets STATUS_API_URL override even a preview build, trailing slash trimmed', async () => {
        process.env.VERCEL_ENV = 'preview'
        process.env.STATUS_API_URL = 'https://api.example.test/'
        expect(await resolveOrigin()).toBe('https://api.example.test')
    })
})
