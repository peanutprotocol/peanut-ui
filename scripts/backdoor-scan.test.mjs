import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scanner = fileURLToPath(new URL('./backdoor-scan.mjs', import.meta.url))

test('scans added code even when a previously committed attribute disables text diffs', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'backdoor-scan-diff-'))
    const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

    try {
        git('init', '-q')
        git('config', 'user.name', 'Scanner Test')
        git('config', 'user.email', 'scanner-test@example.invalid')
        writeFileSync(join(cwd, '.gitattributes'), 'tailwind.config.js -diff\n')
        writeFileSync(join(cwd, 'tailwind.config.js'), 'module.exports = {}\n')
        git('add', '.gitattributes', 'tailwind.config.js')
        git('commit', '-qm', 'mark config as binary for diffs')
        const base = git('rev-parse', 'HEAD')

        writeFileSync(join(cwd, 'tailwind.config.js'), `module.exports = {};${' '.repeat(80)}eval('1')\n`)
        git('add', 'tailwind.config.js')
        git('commit', '-qm', 'add hidden config code')

        const ordinaryDiff = git('diff', '--unified=0', `${base}...HEAD`)
        assert.match(ordinaryDiff, /Binary files .* differ/)
        assert.doesNotMatch(ordinaryDiff, /eval\('1'\)/)

        for (const args of [
            ['--base', base, '--head', 'HEAD'],
            ['--local', '--base', base],
        ]) {
            const result = spawnSync(process.execPath, [scanner, ...args], { cwd, encoding: 'utf8' })
            assert.equal(result.status, 1, `${args.join(' ')}: ${result.stdout}${result.stderr}`)
            assert.match(result.stdout, /BLOCK hidden-code/)
            assert.match(result.stdout, /BLOCK suspicious/)
            assert.match(result.stdout, /2 blocking finding\(s\) in 1 added lines/)
        }
    } finally {
        rmSync(cwd, { recursive: true, force: true })
    }
})
