import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { prepareWorker, workerConfiguration } from './worker/prepare.mjs'

const base = {
    SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
    SCREEN_LIBRARY_R2_JURISDICTION: 'eu',
}
const gallery = { ...base, SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me' }
const comments = {
    SCREEN_LIBRARY_COMMENTS_DATABASE_ID: '12AB5678-1234-1234-1234-123456789abc',
    SCREEN_LIBRARY_COMMENTS_DATABASE_NAME: 'peanut-screen-library-comments',
    SCREEN_LIBRARY_ACCESS_AUD: 'a'.repeat(64),
    SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: 'peanut.cloudflareaccess.com',
}
const entryHtml = `<!doctype html>
<html><head>
    <script defer src="/screen-library/comments.js"></script>
    <script defer src="/screen-library/viewer.js"></script>
</head><body>fixture:index.html</body></html>
`

test('custom-domain deployments disable alternate workers.dev and preview URLs', () => {
    const configuration = workerConfiguration({
        ...base,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
    })
    assert.equal(configuration.workers_dev, false)
    assert.equal(configuration.preview_urls, false)
    assert.deepEqual(configuration.routes, [{ pattern: 'screens.peanut.me', custom_domain: true }])
})

test('workers.dev deployments retain only their configured production hostname', () => {
    const configuration = workerConfiguration({
        ...base,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://peanut-screen-library.peanut-screens.workers.dev',
    })
    assert.equal(configuration.workers_dev, true)
    assert.equal(configuration.preview_urls, false)
    assert.equal(configuration.routes, undefined)
})

test('the existing R2-only gallery does not acquire a D1 binding from shared Access variables', () => {
    const configuration = workerConfiguration({
        ...gallery,
        SCREEN_LIBRARY_ACCESS_AUD: comments.SCREEN_LIBRARY_ACCESS_AUD,
        SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: comments.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN,
    })
    assert.equal(configuration.d1_databases, undefined)
    assert.equal(configuration.vars, undefined)
    assert.deepEqual(configuration.r2_buckets, [
        { binding: 'REPORTS', bucket_name: 'screens-library', jurisdiction: 'eu' },
    ])
})

test('comments pin the exact D1 database, migration directory, audience and team issuer', () => {
    const configuration = workerConfiguration({ ...gallery, ...comments })
    assert.deepEqual(configuration.d1_databases, [
        {
            binding: 'COMMENTS',
            database_name: 'peanut-screen-library-comments',
            database_id: comments.SCREEN_LIBRARY_COMMENTS_DATABASE_ID.toLowerCase(),
            migrations_dir: './migrations',
        },
    ])
    assert.deepEqual(configuration.vars, {
        SCREEN_LIBRARY_ACCESS_AUD: comments.SCREEN_LIBRARY_ACCESS_AUD,
        SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: comments.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN,
    })
})

test('partially configured comments fail before deployment', () => {
    for (const key of Object.keys(comments)) {
        const env = { ...gallery, ...comments }
        delete env[key]
        assert.throws(() => workerConfiguration(env), new RegExp(key), key)
    }
})

test('malformed database and untrusted issuer inputs are rejected', () => {
    for (const [key, values] of [
        ['SCREEN_LIBRARY_COMMENTS_DATABASE_ID', ['not-a-uuid', '../database', ' 12ab5678-1234-1234-1234-123456789abc']],
        ['SCREEN_LIBRARY_COMMENTS_DATABASE_NAME', ['../database', 'name with spaces', 'a'.repeat(64)]],
        ['SCREEN_LIBRARY_ACCESS_AUD', [' ', 'audience\nspoof', 'a'.repeat(257)]],
        [
            'SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN',
            [
                'https://peanut.cloudflareaccess.com',
                'peanut.cloudflareaccess.com.evil.example',
                'evil.example',
                'peanut.cloudflareaccess.com/path',
            ],
        ],
    ])
        for (const value of values)
            assert.throws(
                () => workerConfiguration({ ...gallery, ...comments, [key]: value }),
                new RegExp(key),
                `${key}=${value}`
            )
})

function packagingFixture(run) {
    const directory = mkdtempSync(join(tmpdir(), 'screen-worker-prepare-'))
    const source = join(directory, 'source')
    const target = join(directory, 'output')
    const previous = process.cwd()
    try {
        for (const folder of [
            'public/screen-library',
            'scripts/screens/worker/migrations',
            'scripts/screens/deploy/node_modules/jose',
        ])
            mkdirSync(join(source, folder), { recursive: true })
        writeFileSync(join(source, 'public/screen-library/index.html'), entryHtml)
        for (const file of ['viewer.js', 'viewer.css', 'comments.js'])
            writeFileSync(join(source, 'public/screen-library', file), `fixture:${file}`)
        for (const file of ['index.mjs', 'comments.mjs', 'comments-auth.mjs'])
            writeFileSync(join(source, 'scripts/screens/worker', file), `fixture:${file}`)
        writeFileSync(
            join(source, 'scripts/screens/worker/migrations/0001_comments.sql'),
            'CREATE TABLE comments (id TEXT PRIMARY KEY);'
        )
        writeFileSync(join(source, 'scripts/screens/deploy/node_modules/jose/package.json'), '{"name":"jose"}')
        process.chdir(source)
        run({ source, target })
    } finally {
        process.chdir(previous)
        rmSync(directory, { recursive: true, force: true })
    }
}

test('prepared Worker includes comment assets, backend, additive migrations and isolated dependencies', () => {
    packagingFixture(({ source, target }) => {
        prepareWorker(target, { ...gallery, ...comments })
        for (const file of ['viewer.js', 'viewer.css', 'comments.js'])
            assert.equal(readFileSync(join(target, 'assets/screen-library', file), 'utf8'), `fixture:${file}`)
        for (const file of ['assets/index.html', 'assets/screen-library/index.html']) {
            const html = readFileSync(join(target, file), 'utf8')
            assert.equal(html, entryHtml)
            assert.match(html, /<script defer src="\/screen-library\/comments\.js"><\/script>/)
            assert.match(html, /<script defer src="\/screen-library\/viewer\.js"><\/script>/)
        }
        for (const file of ['index.mjs', 'comments.mjs', 'comments-auth.mjs'])
            assert.equal(readFileSync(join(target, file), 'utf8'), `fixture:${file}`)
        assert.equal(
            readFileSync(join(target, 'migrations/0001_comments.sql'), 'utf8'),
            'CREATE TABLE comments (id TEXT PRIMARY KEY);'
        )
        assert.deepEqual(
            JSON.parse(readFileSync(join(target, 'wrangler.json'), 'utf8')),
            workerConfiguration({ ...gallery, ...comments })
        )
        assert.equal(
            realpathSync(join(target, 'node_modules')),
            realpathSync(join(source, 'scripts/screens/deploy/node_modules'))
        )
        prepareWorker(target, { ...gallery, ...comments })
        assert.equal(
            realpathSync(join(target, 'node_modules')),
            realpathSync(join(source, 'scripts/screens/deploy/node_modules'))
        )
    })
})

test('R2-only preparation removes the comments script from both entries, including rollback over an enabled target', () => {
    packagingFixture(({ target }) => {
        prepareWorker(target, { ...gallery, ...comments })
        prepareWorker(target, gallery)
        for (const file of ['assets/index.html', 'assets/screen-library/index.html']) {
            const html = readFileSync(join(target, file), 'utf8')
            assert.doesNotMatch(html, /comments\.js/)
            assert.match(html, /<script defer src="\/screen-library\/viewer\.js"><\/script>/)
            assert.match(html, /fixture:index\.html/)
        }
        assert.equal(readFileSync(join(target, 'assets/screen-library/comments.js'), 'utf8'), 'fixture:comments.js')
        assert.equal(JSON.parse(readFileSync(join(target, 'wrangler.json'), 'utf8')).d1_databases, undefined)
        prepareWorker(target, { ...gallery, ...comments })
        for (const file of ['assets/index.html', 'assets/screen-library/index.html'])
            assert.equal(readFileSync(join(target, file), 'utf8'), entryHtml)
    })
})

test('packaging rejects invalid configuration and missing dependencies before writing output', () => {
    packagingFixture(({ source, target }) => {
        assert.throws(
            () =>
                prepareWorker(target, {
                    ...gallery,
                    ...comments,
                    SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: 'untrusted.example',
                }),
            /SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN/
        )
        assert.equal(existsSync(target), false)
        rmSync(join(source, 'scripts/screens/deploy/node_modules/jose'), { recursive: true })
        assert.throws(() => prepareWorker(target, gallery), /npm ci --ignore-scripts --prefix scripts\/screens\/deploy/)
        assert.equal(existsSync(target), false)
    })
})

test('packaging preserves unrelated dependency directories instead of replacing them', () => {
    packagingFixture(({ target }) => {
        mkdirSync(join(target, 'node_modules'), { recursive: true })
        writeFileSync(join(target, 'node_modules/keep.txt'), 'unrelated files')
        assert.throws(() => prepareWorker(target, gallery), /isolated deployment dependencies/)
        assert.equal(readFileSync(join(target, 'node_modules/keep.txt'), 'utf8'), 'unrelated files')
        assert.equal(existsSync(join(target, 'wrangler.json')), false)
    })
})
