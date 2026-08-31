const fs = require('fs')
const os = require('os')
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

    const exposed =
        withoutEntrypoint + '\nmodule.exports = { missingNativeEnv, unbakedNativeEnv, REQUIRED_NATIVE_ENV }\n'

    const mod = new Module(SCRIPT_PATH, null)
    mod.filename = SCRIPT_PATH
    mod.paths = Module._nodeModulePaths(path.dirname(SCRIPT_PATH))
    mod._compile(exposed, SCRIPT_PATH)
    return mod.exports
}

const { missingNativeEnv, unbakedNativeEnv, REQUIRED_NATIVE_ENV } = loadScriptInternals()

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

    // dotenv unwraps matching quotes: `KEY=""` and `KEY='  '` bake '' just like `KEY=`
    it('treats a quoted-empty or quoted-whitespace value as missing, and a quoted value as set', () => {
        const withQuotes = (key) => {
            if (key === 'NEXT_PUBLIC_BASE_URL') return `${key}=""`
            if (key === 'NEXT_PUBLIC_SENTRY_DSN') return `${key}='   '`
            return `${key}="set"`
        }
        const env = REQUIRED_NATIVE_ENV.map(withQuotes).join('\n')
        expect(missingNativeEnv(env).sort()).toEqual(['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_SENTRY_DSN'])
    })

    // The three ways a per-key regex used to disagree with dotenv — each one passed
    // the check while the bundle baked something else.

    // dotenv keeps the LAST assignment, so a trailing `KEY=` wins over an earlier value.
    it('judges a repeated key by its last assignment', () => {
        const env = [...REQUIRED_NATIVE_ENV.map((key) => `${key}=set`), 'NEXT_PUBLIC_SENTRY_DSN='].join('\n')
        expect(missingNativeEnv(env)).toEqual(['NEXT_PUBLIC_SENTRY_DSN'])
    })

    // dotenv strips an unquoted trailing comment, so `KEY= # todo` bakes '' — not '# todo'.
    it('strips an inline comment before judging the value', () => {
        const env = REQUIRED_NATIVE_ENV.map((key) =>
            key === 'NEXT_PUBLIC_BASE_URL' ? `${key}= # todo` : `${key}=set # baked by CI`
        ).join('\n')
        expect(missingNativeEnv(env)).toEqual(['NEXT_PUBLIC_BASE_URL'])
    })

    // dotenv accepts `export KEY=value`, so a source-able local file must not fail the check.
    it('accepts an export prefix', () => {
        const env = REQUIRED_NATIVE_ENV.map((key) => `export ${key}=set`).join('\n')
        expect(missingNativeEnv(env)).toEqual([])
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

// The pre-build check can only see the file. This one reads the export, so a value the
// file carried but the bundle never inlined — the outage one step further down the lane
// — is caught before the bundle ships.
describe('unbakedNativeEnv', () => {
    const values = Object.fromEntries(REQUIRED_NATIVE_ENV.map((key) => [key, `value-for-${key}`]))

    function bundleOf(keys) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-out-'))
        fs.mkdirSync(path.join(dir, 'chunks'))
        fs.writeFileSync(path.join(dir, 'chunks', 'app.js'), keys.map((key) => `"${values[key]}"`).join(';'))
        // a value hiding in a non-.js asset must not count: only .js ships as code
        fs.writeFileSync(path.join(dir, 'index.html'), REQUIRED_NATIVE_ENV.map((key) => values[key]).join(' '))
        return dir
    }

    it('reports nothing when every required value is inlined somewhere in out/', () => {
        expect(unbakedNativeEnv(values, bundleOf(REQUIRED_NATIVE_ENV))).toEqual([])
    })

    it('reports a value the export never inlined', () => {
        const partial = REQUIRED_NATIVE_ENV.filter((key) => key !== 'NEXT_PUBLIC_SENTRY_DSN')
        expect(unbakedNativeEnv(values, bundleOf(partial))).toEqual(['NEXT_PUBLIC_SENTRY_DSN'])
    })

    // The pre-build check has already thrown on these in CI; locally it only warns, and
    // a key with no value is not evidence of a broken export.
    it('skips a key that had no value to look for', () => {
        const withHole = { ...values, NEXT_PUBLIC_POSTHOG_KEY: '' }
        const partial = REQUIRED_NATIVE_ENV.filter((key) => key !== 'NEXT_PUBLIC_POSTHOG_KEY')
        expect(unbakedNativeEnv(withHole, bundleOf(partial))).toEqual([])
    })
})
