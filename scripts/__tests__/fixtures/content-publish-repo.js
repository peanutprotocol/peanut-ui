const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

function git(cwd, ...args) {
    return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'test',
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'test',
            GIT_COMMITTER_EMAIL: 'test@example.com',
        },
    }).trim()
}

// The content submodule is a gitlink: a tree entry that names a commit of
// another repository. A publish changes only that entry.
function setContentPointer(cwd, fill) {
    git(cwd, 'update-index', '--add', '--cacheinfo', `160000,${fill.repeat(40)},src/content`)
}

function setFile(cwd, file, text) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), `${text}\n`)
    git(cwd, 'add', file)
}

function setCode(cwd, text) {
    setFile(cwd, 'app.txt', text)
}

function commit(cwd, message) {
    git(cwd, 'commit', '-q', '-m', message)
    return git(cwd, 'rev-parse', 'HEAD')
}

// source -> content -> contentThenCode on main; code and mixed branch from source.
// source -> goMap -> webOnly -> webOnlyThenCode on web-only; nearMiss branches from source.
function makeRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-source-guard-'))
    git(dir, 'init', '-q', '-b', 'main')
    setCode(dir, 'v1')
    setContentPointer(dir, '1')
    const source = commit(dir, 'release source')
    setContentPointer(dir, '2')
    const content = commit(dir, 'content publish')
    setContentPointer(dir, '3')
    const secondContent = commit(dir, 'second content publish')
    setCode(dir, 'v2')
    const contentThenCode = commit(dir, 'code after content')

    git(dir, 'checkout', '-q', '-b', 'code', source)
    setCode(dir, 'v2')
    const code = commit(dir, 'code change')

    git(dir, 'checkout', '-q', '-b', 'mixed', source)
    setCode(dir, 'v2')
    setContentPointer(dir, '2')
    const mixed = commit(dir, 'code and content in one commit')

    // The /go/ map and creator pages (scripts/release-web-only-paths.json).
    git(dir, 'checkout', '-q', '-b', 'web-only', source)
    setFile(dir, 'src/features/go-links/go-map.ts', 'v2')
    setFile(dir, 'src/app/go/[...key]/page.tsx', 'v2')
    const goMap = commit(dir, 'go map line')
    setFile(dir, 'src/app/c/[username]/page.tsx', 'v1')
    setFile(dir, 'src/features/creator-pages/variants.ts', 'v1')
    setFile(dir, 'public/creator-pages/nita.webp', 'v1')
    setContentPointer(dir, '2')
    const webOnly = commit(dir, 'creator page and content publish')
    setCode(dir, 'v2')
    const webOnlyThenCode = commit(dir, 'code after web-only changes')

    // Paths that share a prefix with a web-only folder but sit outside it.
    git(dir, 'checkout', '-q', '-b', 'near-miss', source)
    setFile(dir, 'src/app/gold/page.tsx', 'v1')
    setFile(dir, 'src/features/go-links-legacy/map.ts', 'v1')
    setFile(dir, 'src/app/c.tsx', 'v1')
    const nearMiss = commit(dir, 'files next to the web-only folders')

    // Same tree as a content publish, but history that does not contain source.
    git(dir, 'checkout', '-q', '--orphan', 'rewritten')
    setCode(dir, 'v1')
    setContentPointer(dir, '2')
    const unrelated = commit(dir, 'rewritten main')

    git(dir, 'checkout', '-q', 'main')
    return {
        dir,
        source,
        content,
        secondContent,
        contentThenCode,
        code,
        mixed,
        goMap,
        webOnly,
        webOnlyThenCode,
        nearMiss,
        unrelated,
    }
}

module.exports = { git, makeRepo }
