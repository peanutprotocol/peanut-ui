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

function setCode(cwd, text) {
    fs.writeFileSync(path.join(cwd, 'app.txt'), `${text}\n`)
    git(cwd, 'add', 'app.txt')
}

function commit(cwd, message) {
    git(cwd, 'commit', '-q', '-m', message)
    return git(cwd, 'rev-parse', 'HEAD')
}

// source -> content -> contentThenCode on main; code and mixed branch from source.
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

    // Same tree as a content publish, but history that does not contain source.
    git(dir, 'checkout', '-q', '--orphan', 'rewritten')
    setCode(dir, 'v1')
    setContentPointer(dir, '2')
    const unrelated = commit(dir, 'rewritten main')

    git(dir, 'checkout', '-q', 'main')
    return { dir, source, content, secondContent, contentThenCode, code, mixed, unrelated }
}

module.exports = { git, makeRepo }
