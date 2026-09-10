/**
 * App Links coverage: the iOS AASA and the Android intent-filter are two
 * hand-maintained copies of one list. They drifted once already (a route
 * claimed on one platform only opens the app on that platform, and the bug
 * looks like "deep links are flaky on Android"), so parity is pinned here.
 *
 * /app gets its own case: it is the smart download link every QR encodes, and
 * an installed user who scans one must land in the app — that is the whole
 * point of claiming it (TASK-21788).
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
    /*
     * SKIPPED, NOT ABANDONED — restore both with the next native release.
     *
     * The `/app` claim never reached a binary: v1.6.0 predates d91ea7cee, so its
     * manifest and AASA carry no `/app` at all, and an intent filter cannot be
     * shipped over the air. What the two lines did reach was
     * check-native-ota-surface, which compares this tree's native fingerprint
     * against the binary an OTA targets — so they blocked every bundle while
     * delivering nothing, with production stuck on JS older than the binary
     * running it.
     *
     * Both platforms were reverted together, deliberately: dropping only the
     * Android half would manufacture exactly the drift the parity case below
     * exists to catch, and that case stays live. Restoring these two is part of
     * cutting the next native release — see docs/NATIVE-RELEASE.md.
     */
    it.skip('claims /app and /app/* for every iOS appID', () => {
        expect(details.length).toBeGreaterThan(0)
        for (const detail of details) {
            expect(detail.paths).toContain('/app')
            expect(detail.paths).toContain('/app/*')
        }
    })

    it.skip('claims /app on Android with the same exact-plus-prefix shape', () => {
        expect(androidPaths).toContain('/app')
        expect(androidPrefixes).toContain('/app/')
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
