/**
 * App Links coverage: the iOS AASA and the Android intent-filter are two
 * hand-maintained copies of one list. They drifted once already (a route
 * claimed on one platform only opens the app on that platform, and the bug
 * looks like "deep links are flaky on Android"), so parity is pinned here.
 *
 * /app gets its own negative case: it is a web-only smart-store route and must
 * not expand the native surface. Download QRs enter through the already-shipped
 * /home association and use an app_entry query marker (TASK-21788).
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
// extension-less JSON — require() won't parse it
const aasa = JSON.parse(readFileSync(join(ROOT, 'public/.well-known/apple-app-site-association'), 'utf8')) as {
    applinks: { details: { appID: string; paths: string[] }[] }
}
const manifest = readFileSync(join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8')

const details = aasa.applinks.details
const androidPaths = [...manifest.matchAll(/android:path="([^"]+)"/g)].map((m) => m[1])
const androidPrefixes = [...manifest.matchAll(/android:pathPrefix="([^"]+)"/g)].map((m) => m[1])

describe('App Links', () => {
    it('keeps the web-only /app route out of every iOS appID', () => {
        expect(details.length).toBeGreaterThan(0)
        for (const detail of details) {
            expect(detail.paths).not.toContain('/app')
            expect(detail.paths).not.toContain('/app/*')
        }
    })

    it('keeps the web-only /app route out of Android', () => {
        expect(androidPaths).not.toContain('/app')
        expect(androidPrefixes).not.toContain('/app/')
    })

    it('lists the same paths for every iOS appID', () => {
        const [first, ...rest] = details
        for (const detail of rest) {
            expect(detail.paths).toEqual(first.paths)
        }
    })

    it('keeps the iOS and Android lists in parity', () => {
        const iosExact = details[0].paths.filter((p) => !p.endsWith('/*'))
        const iosWildcard = details[0].paths.filter((p) => p.endsWith('/*')).map((p) => p.replace(/\*$/, ''))
        expect([...androidPaths].sort()).toEqual([...iosExact].sort())
        expect([...androidPrefixes].sort()).toEqual([...iosWildcard].sort())
    })
})
