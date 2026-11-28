const { execFileSync, spawnSync } = require('child_process')
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('fs')
const { tmpdir } = require('os')
const path = require('path')

// Drive the real checker against a tiny repo: one spec that models src/owner.ts.
const SCRIPT = path.join(__dirname, '..', 'check-model-sync.mjs')
const SPEC = '---- MODULE Payout ----\n(* One payout.\n   Models: src/owner.ts\n*)\n====\n'

let repo

function git(...args) {
    return execFileSync(
        'git',
        [
            '-c',
            'user.name=t',
            '-c',
            'user.email=t@t',
            '-c',
            'core.hooksPath=/dev/null',
            '-c',
            'commit.gpgsign=false',
            ...args,
        ],
        { cwd: repo, encoding: 'utf-8' }
    )
}
function write(file, text) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    writeFileSync(path.join(repo, file), text)
}
function commit(message) {
    git('add', '-A')
    git('commit', '-q', '-m', message)
}
function check(...args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: 'utf-8' })
}

beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'model-sync-'))
    git('init', '-q', '-b', 'base')
    write('verification/tla/Payout.tla', SPEC)
    write('verification/tla/Payout_Fixed.cfg', 'SPECIFICATION Spec\n')
    write('verification/tla/Payout_Buggy.cfg', '\\* Replay: src/owner.test.ts › replays bug\nSPECIFICATION Spec\n')
    write('src/owner.ts', 'export const pay = 1\n')
    write('src/owner.test.ts', 'test("replays bug", () => {})\n')
    write('src/other.ts', 'export const other = 1\n')
    commit('base')
    git('checkout', '-q', '-b', 'feature')
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('check-model-sync', () => {
    it('fails when a modelled file changes and its spec does not', () => {
        write('src/owner.ts', 'export const pay = 2\n')
        commit('change the payout')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('src/owner.ts is modelled by verification/tla/Payout.tla')
    })

    it('passes when the spec or one of its configs changes with the code', () => {
        write('src/owner.ts', 'export const pay = 2\n')
        write(
            'verification/tla/Payout_Buggy.cfg',
            '\\* Replay: src/owner.test.ts › replays bug\n\\* updated\nSPECIFICATION Spec\n'
        )
        commit('change the payout and its config')
        expect(check('--base-ref', 'base').status).toBe(0)
    })

    it('passes with a Model-unchanged trailer on the commit touching that file', () => {
        write('src/owner.ts', 'export const pay = 2\n')
        commit('rename a local\n\nModel-unchanged: a rename, no behaviour change')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('a rename, no behaviour change')
    })

    it('does NOT let a Model-unchanged trailer on an unrelated commit excuse a later modelled file', () => {
        write('src/other.ts', 'export const other = 2\n')
        commit('unrelated edit\n\nModel-unchanged: unrelated')
        write('src/owner.ts', 'export const pay = 2\n')
        commit('real change without trailer')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('src/owner.ts is modelled by verification/tla/Payout.tla')
    })

    it('fails when a Buggy config names a Replay test title not present in the test file', () => {
        write(
            'verification/tla/Payout_Buggy.cfg',
            '\\* Replay: src/owner.test.ts › missing title\nSPECIFICATION Spec\n'
        )
        commit('break replay title')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('Replay test title "missing title" was not found')
    })

    it('ignores a changed file no spec models', () => {
        write('src/other.ts', 'export const other = 2\n')
        commit('change something else')
        expect(check('--base-ref', 'base').status).toBe(0)
    })

    it('fails on a modelled path that does not exist', () => {
        write(
            'verification/tla/Payout.tla',
            '---- MODULE Payout ----\n(* One payout.\n   Models: src/owner.ts, src/missing.ts\n*)\n====\n'
        )
        commit('reference missing path')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('models src/missing.ts, which does not exist')
    })

    it('fails when a Buggy config omits or breaks its Replay target', () => {
        write(
            'verification/tla/Payout_Buggy.cfg',
            '\\* Replay: src/nonexistent.test.ts › missing\nSPECIFICATION Spec\n'
        )
        commit('break replay path')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('Replay target "src/nonexistent.test.ts" does not exist')
    })

    it('fails on a spec with no Models line', () => {
        write('verification/tla/Orphan.tla', '---- MODULE Orphan ----\n====\n')
        commit('add a spec')
        const result = check('--base-ref', 'base')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('Orphan.tla has no "Models:" line')
    })
})
