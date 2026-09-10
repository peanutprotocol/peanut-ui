/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'

// Walk the app router and collect the route every page.tsx produces. Route
// groups — the `(name)` folders — add no path segment.
function routesUnder(dir: string, base = ''): string[] {
    const routes: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            const segment = entry.name.startsWith('(') ? base : `${base}/${entry.name}`
            routes.push(...routesUnder(path.join(dir, entry.name), segment))
        } else if (entry.name === 'page.tsx') {
            routes.push(base || '/')
        }
    }
    return routes
}

const DEV_ROUTES = routesUnder(path.join(process.cwd(), 'src/app')).filter((route) => route.startsWith('/dev'))

// Only these two answer on peanut.me. Widening this list is a deliberate act:
// payment-graph is the event visualisation (full-graph was dropped — the legacy
// page loads the same team-gated dataset without the explorer's telemetry
// suppression), safe-area reads device insets on the production native build.
const ALLOWED_ON_PROD = ['/dev/payment-graph', '/dev/safe-area']

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

// The gate reads env at module load, so re-import it as a peanut.me build.
async function loadProdBuild() {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://peanut.me'
    jest.resetModules()
    const { proxy, config } = await import('@/proxy')
    return { proxy, config }
}

afterAll(() => {
    process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL
    jest.resetModules()
})

describe('dev routes on peanut.me', () => {
    it('finds the dev pages on disk', () => {
        // guards the walker itself — an empty list would make everything below pass
        expect(DEV_ROUTES.length).toBeGreaterThan(20)
        expect(DEV_ROUTES).toEqual(expect.arrayContaining(['/dev', '/dev/debug', '/dev/ds', ...ALLOWED_ON_PROD]))
    })

    it('404s every dev page except the allowed ones', async () => {
        const { proxy } = await loadProdBuild()

        // every route goes through the proxy — so the allowlist is asserted
        // to actually answer, not just skipped by the filter
        const answering = DEV_ROUTES.filter(
            (route) => proxy(new NextRequest(`https://peanut.me${route}`))?.status !== 404
        )

        expect(answering.sort()).toEqual(ALLOWED_ON_PROD)
    })

    it('keeps /dev in the proxy matcher', async () => {
        const { config } = await loadProdBuild()

        expect(config.matcher).toContain('/dev/:path*')
    })
})
