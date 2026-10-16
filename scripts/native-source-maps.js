const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

function sourceMaps(directory) {
    if (!fs.existsSync(directory)) return []
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name)
        return entry.isDirectory() ? sourceMaps(file) : entry.name.endsWith('.map') ? [file] : []
    })
}

function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const UPLOAD_ATTEMPTS = 3

function processNativeSourceMaps({
    root = path.join(__dirname, '..'),
    env = process.env,
    run = execFileSync,
    warn = console.warn,
    sleep = sleepSync,
} = {}) {
    const out = path.join(root, 'out')
    const maps = sourceMaps(out)
    const required = env.SENTRY_NATIVE_UPLOAD_REQUIRED === 'true'
    try {
        if (!maps.length) {
            if (required) throw new Error('Native source maps missing from export')
            warn('Native source maps missing; Sentry upload skipped')
            return
        }
        if (!env.SENTRY_AUTH_TOKEN) {
            if (required) throw new Error('SENTRY_AUTH_TOKEN is required for native release source maps')
            warn('SENTRY_AUTH_TOKEN absent; local native source-map upload skipped')
            return
        }
        const cli = path.join(root, 'node_modules', '.bin', 'sentry-cli')
        const assets = path.join(out, '_next', 'static')
        const release = run('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
        const options = { cwd: root, env, stdio: 'inherit' }
        // Inject into the exact JS that will be packaged. Debug IDs work across
        // capacitor:// and https:// origins without public source-map URLs.
        run(cli, ['sourcemaps', 'inject', assets], options)
        const upload = [
            'sourcemaps',
            'upload',
            '--org',
            'peanut-c34d84c05',
            '--project',
            'peanut-ui',
            '--release',
            release,
            '--url-prefix',
            '~/_next/static',
            '--validate',
            assets,
        ]
        // The upload only feeds Sentry's stack traces; the bundle is complete
        // without it. A DNS blip on us.sentry.io failed the Android 1.10.0 build
        // (Oct 9 2026), so retry with backoff and then warn instead of failing.
        // Missing maps or a missing token above are configuration errors and
        // still fail a release.
        for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
            try {
                run(cli, upload, options)
                return
            } catch (error) {
                if (attempt === UPLOAD_ATTEMPTS) {
                    warn(
                        `::warning::Sentry source-map upload failed ${UPLOAD_ATTEMPTS} times (${error.message}); ` +
                            `release ${release} ships without uploaded source maps`
                    )
                    return
                }
                warn(`Sentry source-map upload failed (${error.message}); retry ${attempt} of ${UPLOAD_ATTEMPTS - 1}`)
                sleep(5000 * attempt)
            }
        }
    } finally {
        // Never package application source, including after an upload failure.
        for (const map of maps) fs.rmSync(map, { force: true })
    }
}

module.exports = { processNativeSourceMaps, sourceMaps }
