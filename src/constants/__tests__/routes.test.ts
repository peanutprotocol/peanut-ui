import fs from 'fs'
import path from 'path'
import { DEDICATED_ROUTES } from '../routes'

// Guards against the "/card/foo → invalid recipient" class of bug: every
// folder that resolves to a real Next.js route under src/app/ must be
// listed in DEDICATED_ROUTES, or unknown sub-paths get swallowed by the
// [...recipient] catch-all and reinterpreted as a payment.
const APP_DIR = path.resolve(__dirname, '../../app')

// Files that mark a directory as a real Next.js route (page) or handler.
const ROUTE_FILES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts', 'route.js'])

function containsRouteFile(dir: string): boolean {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && ROUTE_FILES.has(entry.name)) return true
        if (entry.isDirectory() && containsRouteFile(path.join(dir, entry.name))) return true
    }
    return false
}

// Collect first-URL-segment names by walking src/app/ and unwrapping route
// groups `(name)`. Skip dynamic segments `[name]` — those are the catch-alls
// themselves, not things to reserve from them.
function collectRouteSegments(dir: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('[')) continue
        const childPath = path.join(dir, entry.name)
        if (entry.name.startsWith('(')) {
            out.push(...collectRouteSegments(childPath))
            continue
        }
        if (containsRouteFile(childPath)) out.push(entry.name)
    }
    return out
}

describe('DEDICATED_ROUTES', () => {
    it('reserves every top-level route folder under src/app/', () => {
        const segments = Array.from(new Set(collectRouteSegments(APP_DIR)))
        const missing = segments.filter((s) => !(DEDICATED_ROUTES as readonly string[]).includes(s))
        expect(missing).toEqual([])
    })
})
