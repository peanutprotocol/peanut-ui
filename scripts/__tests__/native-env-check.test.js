const fs = require('fs')
const path = require('path')
const Module = require('module')

const SCRIPT_PATH = path.join(__dirname, '..', 'native-build.js')

// native-build.js is a script, not a module: it calls main() at import time and
// exports nothing. Load the real source with that call stripped so the env check
// can be asserted against the list the build actually enforces.
function loadScriptInternals() {
    const source = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    const withoutEntrypoint = source.replace(/\nmain\(\)\s*$/, '\n')
    expect(withoutEntrypoint).not.toBe(source)

    const exposed = withoutEntrypoint + '\nmodule.exports = { missingNativeEnv, REQUIRED_NATIVE_ENV }\n'

    const mod = new Module(SCRIPT_PATH, null)
    mod.filename = SCRIPT_PATH
    mod.paths = Module._nodeModulePaths(path.dirname(SCRIPT_PATH))
    mod._compile(exposed, SCRIPT_PATH)
    return mod.exports
}

const { missingNativeEnv, REQUIRED_NATIVE_ENV } = loadScriptInternals()

describe('missingNativeEnv', () => {
    it('reports nothing when every required key has a value', () => {
        const env = REQUIRED_NATIVE_ENV.map((key) => `${key}=value-for-${key}`).join('\n')
        expect(missingNativeEnv(env)).toEqual([])
    })

    // An empty value bakes `''` into the bundle, which is as dead as an absent key.
    it('reports both an empty value and an absent key', () => {
        const env = REQUIRED_NATIVE_ENV.filter((key) => key !== 'NEXT_PUBLIC_SENTRY_DSN')
            .map((key) => (key === 'NEXT_PUBLIC_BASE_URL' ? `${key}=` : `${key}=set`))
            .join('\n')
        expect(missingNativeEnv(env).sort()).toEqual(['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_SENTRY_DSN'])
    })

    it('ignores comments and blank lines, so a commented-out key still counts as missing', () => {
        const env = [
            '# written by capgo-deploy.yml',
            '',
            ...REQUIRED_NATIVE_ENV.map((key) => (key === 'NEXT_PUBLIC_POSTHOG_KEY' ? `# ${key}=set` : `${key}=set`)),
            '',
        ].join('\n')
        expect(missingNativeEnv(env)).toEqual(['NEXT_PUBLIC_POSTHOG_KEY'])
    })
})
