/** Build only trusted gallery assets, independently of the Peanut app. */
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
const target = resolve(process.argv[2] ?? '.screen-worker')
const bucket = process.env.SCREEN_LIBRARY_R2_BUCKET
const origin = new URL(process.env.SCREEN_LIBRARY_PUBLIC_URL)
if (
    origin.protocol !== 'https:' ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
)
    throw new Error('Configure SCREEN_LIBRARY_PUBLIC_URL as an HTTPS origin')
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new Error('Configure SCREEN_LIBRARY_R2_BUCKET')
mkdirSync(join(target, 'assets', 'screen-library'), { recursive: true })
for (const file of ['index.html', 'viewer.js', 'viewer.css'])
    copyFileSync(`public/screen-library/${file}`, join(target, 'assets', 'screen-library', file))
copyFileSync('public/screen-library/index.html', join(target, 'assets', 'index.html'))
copyFileSync('scripts/screens/worker/index.mjs', join(target, 'index.mjs'))
writeFileSync(
    join(target, 'assets', '_headers'),
    '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n'
)
writeFileSync(
    join(target, 'wrangler.json'),
    JSON.stringify(
        {
            name: 'peanut-screen-library',
            main: 'index.mjs',
            compatibility_date: '2026-09-11',
            workers_dev: true,
            ...(!origin.hostname.endsWith('.workers.dev')
                ? { routes: [{ pattern: origin.hostname, custom_domain: true }] }
                : {}),
            assets: {
                directory: './assets',
                not_found_handling: 'single-page-application',
                run_worker_first: ['/screen-data/*'],
            },
            r2_buckets: [{ binding: 'REPORTS', bucket_name: bucket }],
        },
        null,
        2
    )
)
