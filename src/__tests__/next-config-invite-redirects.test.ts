// Root-domain invite links (peanut.me/?invited_by=alice) must hand off to
// /invite like the legacy peanut.me/?code=alice shape does — the landing page
// ignores the param, so a missed key silently drops attribution.
//
// Loaded under NODE_ENV=development: that branch exports the plain config
// (no Serwist/Sentry wrappers) and redirects() returns exactly the campaign
// hand-offs, which is all this test is about.

async function campaignRedirects(): Promise<Array<Record<string, unknown>>> {
    const previousEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
        let config: { redirects(): Promise<Array<Record<string, unknown>>> } | undefined
        jest.isolateModules(() => {
            config = require('../../next.config.js')
        })
        return await config!.redirects()
    } finally {
        process.env.NODE_ENV = previousEnv
    }
}

describe('root-domain invite redirects', () => {
    it.each(['invited_by', 'code', 'campaign', 'campaignTag'])('hands peanut.me/?%s= off to /invite', async (key) => {
        await expect(campaignRedirects()).resolves.toContainEqual({
            source: '/',
            has: [{ type: 'query', key }],
            destination: '/invite',
            permanent: false,
        })
    })
})
