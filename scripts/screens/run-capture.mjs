/** Builds an exact target revision, then captures it with this checkout's harness. */
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { execFileSync, spawn } from 'node:child_process'
import { resolve, join } from 'node:path'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { prepare } from './prepare.mjs'
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
// Chromium cannot decode. The current capture checkout contains equivalent
// H.264 assets; overlay those files in the disposable target only so the
// before/after comparison measures UI changes instead of codec support.
for (const relative of ['public/iosPwaChrome.mov', 'public/iosPwaSafari.mov']) {
    const harnessAsset = join(process.cwd(), relative)
    const targetAsset = join(source, relative)
    if (harnessAsset !== targetAsset && existsSync(harnessAsset) && existsSync(targetAsset))
        copyFileSync(harnessAsset, targetAsset)
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
