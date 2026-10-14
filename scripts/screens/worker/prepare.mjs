/** Build only trusted gallery assets, independently of the Peanut app. */
import {
    mkdirSync,
    copyFileSync,
    readFileSync,
    writeFileSync,
    existsSync,
    lstatSync,
    readlinkSync,
    readdirSync,
    symlinkSync,
} from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function workerConfiguration(env = process.env) {
    const bucket = env.SCREEN_LIBRARY_R2_BUCKET
    const jurisdiction = env.SCREEN_LIBRARY_R2_JURISDICTION || 'default'
    if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction')
    const origin = new URL(env.SCREEN_LIBRARY_PUBLIC_URL)
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
    const databaseId = env.SCREEN_LIBRARY_COMMENTS_DATABASE_ID
    const databaseName = env.SCREEN_LIBRARY_COMMENTS_DATABASE_NAME
    let comments = {}
    if (databaseId || databaseName) {
        if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(databaseId ?? ''))
            throw new Error('Configure SCREEN_LIBRARY_COMMENTS_DATABASE_ID as a D1 database UUID')
        if (!/^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(databaseName ?? ''))
            throw new Error('Configure SCREEN_LIBRARY_COMMENTS_DATABASE_NAME')
        if (!/^[A-Za-z0-9_-]{8,256}$/.test(env.SCREEN_LIBRARY_ACCESS_AUD ?? ''))
            throw new Error('Configure SCREEN_LIBRARY_ACCESS_AUD for comments')
        if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.cloudflareaccess\.com$/.test(env.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN ?? ''))
            throw new Error('Configure SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN as the pinned Access team hostname')
        comments = {
            d1_databases: [
                {
                    binding: 'COMMENTS',
                    database_name: databaseName,
                    database_id: databaseId.toLowerCase(),
                    migrations_dir: './migrations',
                },
            ],
            vars: {
                SCREEN_LIBRARY_ACCESS_AUD: env.SCREEN_LIBRARY_ACCESS_AUD,
                SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: env.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN,
            },
        }
    }
    const usesWorkersDev = origin.hostname.endsWith('.workers.dev')
    return {
        name: 'peanut-screen-library',
        main: 'index.mjs',
        compatibility_date: '2026-09-11',
        // A custom-domain Access policy must not leave a second public origin.
        workers_dev: usesWorkersDev,
        preview_urls: false,
        ...(!usesWorkersDev ? { routes: [{ pattern: origin.hostname, custom_domain: true }] } : {}),
        assets: {
            directory: './assets',
            not_found_handling: 'single-page-application',
            run_worker_first: ['/screen-data/*'],
        },
        r2_buckets: [{ binding: 'REPORTS', bucket_name: bucket, jurisdiction }],
        ...comments,
    }
}

export function prepareWorker(targetArg = '.screen-worker', env = process.env) {
    const target = resolve(targetArg)
    const configuration = workerConfiguration(env)
    const dependencies = resolve('scripts/screens/deploy/node_modules')
    if (!existsSync(join(dependencies, 'jose', 'package.json')))
        throw new Error(
            'Install locked deployment dependencies with npm ci --ignore-scripts --prefix scripts/screens/deploy'
        )
    const dependencyLink = join(target, 'node_modules')
    let existingLink
    try {
        existingLink = lstatSync(dependencyLink)
    } catch (error) {
        if (error.code !== 'ENOENT') throw error
    }
    if (
        existingLink &&
        (!existingLink.isSymbolicLink() || resolve(target, readlinkSync(dependencyLink)) !== dependencies)
    )
        throw new Error('Deployment target node_modules must link to the isolated deployment dependencies')
    mkdirSync(join(target, 'assets', 'screen-library'), { recursive: true })
    for (const file of ['viewer.js', 'viewer.css', 'comments.js', 'votes.js'])
        copyFileSync(`public/screen-library/${file}`, join(target, 'assets', 'screen-library', file))
    const sourceHtml = readFileSync('public/screen-library/index.html', 'utf8')
    const entryHtml = configuration.d1_databases
        ? sourceHtml
        : sourceHtml.replace(
              /\s*<script\b[^>]*\bsrc=(["'])\/screen-library\/(?:comments|votes)\.js\1[^>]*>\s*<\/script>/g,
              ''
          )
    writeFileSync(join(target, 'assets', 'screen-library', 'index.html'), entryHtml)
    writeFileSync(join(target, 'assets', 'index.html'), entryHtml)
    for (const file of ['index.mjs', 'comments.mjs', 'comments-auth.mjs', 'comments-shared.mjs', 'votes.mjs'])
        copyFileSync(`scripts/screens/worker/${file}`, join(target, file))
    mkdirSync(join(target, 'migrations'), { recursive: true })
    for (const file of readdirSync('scripts/screens/worker/migrations').filter((name) => name.endsWith('.sql')))
        copyFileSync(join('scripts/screens/worker/migrations', file), join(target, 'migrations', file))
    if (!existingLink) symlinkSync(dependencies, dependencyLink, 'dir')
    writeFileSync(
        join(target, 'assets', '_headers'),
        '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n'
    )
    writeFileSync(join(target, 'wrangler.json'), JSON.stringify(configuration, null, 2))
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) prepareWorker(process.argv[2])
