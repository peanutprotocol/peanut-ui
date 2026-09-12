/** Builds an exact target revision, then captures it with this checkout's harness. */
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { execFileSync, spawn } from 'node:child_process'
import { resolve, join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { prepare } from './prepare.mjs'
import { hash } from './core.mjs'
const [sourceArg, sha, outArg] = process.argv.slice(2)
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Expected immutable target SHA')
const source = resolve(sourceArg),
    out = resolve(outArg),
    port = Number(process.env.SCREEN_CAPTURE_PORT ?? 3080)
const base = `http://127.0.0.1:${port}`
async function requireFreePort() {
    const probe = createServer()
    await new Promise((resolve, reject) => {
        probe.once('error', reject)
        probe.listen(port, '127.0.0.1', resolve)
    })
    await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())))
}
await requireFreePort()
const run = (cmd, args, cwd = source) =>
    execFileSync(cmd, args, {
        cwd,
        stdio: 'inherit',
        env: {
            ...process.env,
            NEXT_PUBLIC_VERCEL_ENV: 'preview',
            NEXT_PUBLIC_BASE_URL: 'https://staging.peanut.me',
            SCREEN_CAPTURE_BUILD: '1',
            NEXT_PUBLIC_PEANUT_API_URL: base + '/screen-capture-api',
            NODE_OPTIONS: '--max-old-space-size=6144',
        },
    })
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim()
if (actual !== sha) throw new Error('Wrong target checkout')
run('pnpm', ['install', '--frozen-lockfile'])
prepare(source)
// The legacy iOS PWA videos are HEVC in the base revision, which headless
// Chromium cannot decode. Route only these known legacy hashes to the known
// current H.264 assets during capture; never mutate the target checkout or
// silently substitute a future product-media change.
const mediaOverlays = []
const knownMedia = {
    'public/iosPwaChrome.mov': {
        legacy: 'edb3f74ac4613241cac49d05f37f0cda96f8ab97c37948dfb5b884969a5c0d54',
        capture: '00b291f342f0662dc7533ca8c3d9e323ab526db69df5d126f253eee079101a54',
    },
    'public/iosPwaSafari.mov': {
        legacy: 'bb429422320dcedf68b918728d9ac5d50c6144b8d36cef24260e64ac9ab2e797',
        capture: '59835c948cab1f67488bf4c7be6fd4d742184031037966918f3cb25cb593bc52',
    },
}
for (const [relative, expected] of Object.entries(knownMedia)) {
    const harnessAsset = join(process.cwd(), relative)
    const targetAsset = join(source, relative)
    if (harnessAsset === targetAsset || !existsSync(harnessAsset) || !existsSync(targetAsset)) continue
    const before = hash(readFileSync(targetAsset))
    const after = hash(readFileSync(harnessAsset))
    if (before === expected.legacy && after === expected.capture)
        mediaOverlays.push({
            path: `/${relative.replace(/^public\//, '')}`,
            file: relative,
            source: harnessAsset,
            before,
            after,
        })
}
const nonce = randomUUID()
writeFileSync(
    join(source, 'public/screen-capture-build.json'),
    JSON.stringify({ commit: sha, nonce, publicBase: 'https://staging.peanut.me' })
)
run('pnpm', ['build'])
await requireFreePort()
let serverReady = false
const server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port)], {
    cwd: source,
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
    env: process.env,
})
server.stdout.on('data', (chunk) => {
    process.stdout.write(chunk)
    if (String(chunk).includes('Ready')) serverReady = true
})
try {
    let ready = false
    for (let i = 0; i < 120; i++) {
        if (server.exitCode !== null) throw new Error('App server exited before capture')
        try {
            const r = await fetch(base + '/screen-capture-build.json')
            if (serverReady && r.ok && (await r.json()).nonce === nonce) {
                ready = true
                break
            }
        } catch {}
        await new Promise((r) => setTimeout(r, 1000))
    }
    if (!ready) throw new Error('App server did not start')
    const historical = !existsSync(join(source, 'src/dev/fixtures/registry.ts'))
    run(
        'node',
        [
            '--import',
            'tsx',
            'scripts/screens/capture.ts',
            `--source=${source}`,
            `--sha=${sha}`,
            `--url=${base}`,
            `--out=${out}`,
            `--historical=${historical}`,
            `--asset-overlays=${JSON.stringify(mediaOverlays)}`,
        ],
        process.cwd()
    )
} finally {
    if (server.pid) {
        try {
            process.kill(-server.pid, 'SIGTERM')
        } catch (error) {
            if (error.code !== 'ESRCH') throw error
        }
    }
}
