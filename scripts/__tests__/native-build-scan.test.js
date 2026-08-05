const fs = require('fs')
const path = require('path')
const Module = require('module')

const SCRIPT_PATH = path.join(__dirname, '..', 'native-build.js')

// native-build.js is a script, not a module: it calls main() at import time and
// exports nothing. Load the real source with that call stripped so the scan
// helpers can be asserted against the actual app tree.
function loadScriptInternals() {
    const source = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    const withoutEntrypoint = source.replace(/\nmain\(\)\s*$/, '\n')
    expect(withoutEntrypoint).not.toBe(source)

    const exposed =
        withoutEntrypoint +
        '\nmodule.exports = { isHandledByTransform, detectUncoveredServerRoutes, P0_TRANSFORMS, APP_DIR }\n'

    const mod = new Module(SCRIPT_PATH, null)
    mod.filename = SCRIPT_PATH
    mod.paths = Module._nodeModulePaths(path.dirname(SCRIPT_PATH))
    mod._compile(exposed, SCRIPT_PATH)
    return mod.exports
}

const { isHandledByTransform, detectUncoveredServerRoutes, P0_TRANSFORMS, APP_DIR } = loadScriptInternals()

const toPosix = (p) => p.split(path.sep).join('/')

describe('native build server-route scan', () => {
    it('treats every P0_TRANSFORMS entry as handled', () => {
        for (const transform of P0_TRANSFORMS) {
            expect(isHandledByTransform(transform.path)).toBe(true)
        }
    })

    // The scan passes `path.relative(APP_DIR, full)` into the predicate. If the
    // predicate compared a different path shape it would silently never match.
    it('matches the relative path shape the scan actually computes', () => {
        for (const transform of P0_TRANSFORMS) {
            const absolute = path.join(APP_DIR, transform.path)
            expect(isHandledByTransform(path.relative(APP_DIR, absolute))).toBe(true)
        }
    })

    it('does not suppress routes that are not transformed', () => {
        expect(isHandledByTransform('some/other/page.tsx')).toBe(false)
        expect(isHandledByTransform('api/foo/route.ts')).toBe(false)
        expect(isHandledByTransform('(mobile-ui)/claim/layout.tsx')).toBe(false)
    })

    it('does not flag transformed pages as uncovered server routes', () => {
        const transformed = new Set(P0_TRANSFORMS.map((t) => t.path))
        const offenders = detectUncoveredServerRoutes().filter((o) => transformed.has(toPosix(o.rel)))
        expect(offenders).toEqual([])
    })
})
