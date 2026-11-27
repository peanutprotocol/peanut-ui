/** @jest-environment node */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { git, makeRepo } = require('./fixtures/content-publish-repo')

const SCRIPT = path.join(__dirname, '..', 'release-source-guard.mjs')

function guard(cwd, source, tip) {
    return spawnSync(process.execPath, [SCRIPT, source, tip], { cwd, encoding: 'utf8' })
}

describe('release-source-guard', () => {
    let repo
    beforeAll(() => {
        repo = makeRepo()
    })
    afterAll(() => {
        fs.rmSync(repo.dir, { recursive: true, force: true })
    })

    it('passes when main is still the source commit', () => {
        const result = guard(repo.dir, repo.source, repo.source)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('main is still')
    })

    it('passes when main moved by content publishes only', () => {
        expect(guard(repo.dir, repo.source, repo.content).status).toBe(0)
        const result = guard(repo.dir, repo.source, repo.secondContent)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('by web-only paths only')
    })

    it('passes when main moved by the /go/ map, creator pages and content only', () => {
        expect(guard(repo.dir, repo.source, repo.goMap).status).toBe(0)
        const result = guard(repo.dir, repo.source, repo.webOnly)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('by web-only paths only')
    })

    it('fails when a code commit follows web-only changes', () => {
        const result = guard(repo.dir, repo.source, repo.webOnlyThenCode)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('changes beyond the web-only paths: app.txt')
    })

    it('fails on a path that only shares a prefix with a web-only folder', () => {
        const result = guard(repo.dir, repo.source, repo.nearMiss)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('src/app/c.tsx, src/app/gold/page.tsx, src/features/go-links-legacy/map.ts')
    })

    it('fails when main moved by code', () => {
        const result = guard(repo.dir, repo.source, repo.code)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('changes beyond the web-only paths: app.txt')
    })

    it('fails when one commit changes code and content', () => {
        expect(guard(repo.dir, repo.source, repo.mixed).status).toBe(1)
    })

    it('fails when a code commit follows a content publish', () => {
        expect(guard(repo.dir, repo.source, repo.contentThenCode).status).toBe(1)
    })

    it('fails when main no longer contains the source commit', () => {
        const result = guard(repo.dir, repo.source, repo.unrelated)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('does not contain')
    })

    it('fails closed on input it cannot check', () => {
        expect(guard(repo.dir, repo.source, '').status).toBe(1)
        expect(guard(repo.dir, repo.source, 'main').status).toBe(1)
        // Not in the repository, and there is no origin to fetch it from.
        expect(guard(repo.dir, repo.source, 'f'.repeat(40)).status).toBe(1)
    })

    // GitHub would skip the OTA for such a push while the guard stopped the
    // running release, so nothing would ever ship it. The reverse would publish
    // an OTA mid-release that the guard does not expect.
    it('reads the same path list as the release-ota.yml paths-ignore', () => {
        const webOnlyPaths = require('../release-web-only-paths.json')
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '..', '.github', 'workflows', 'release-ota.yml'),
            'utf8'
        )
        const block = workflow.match(/\n {8}paths-ignore:\n((?: {12}- .+\n)+)/)
        expect(block).not.toBeNull()
        const ignored = block[1]
            .split('\n')
            .filter(Boolean)
            .map((line) => line.replace(/^ {12}- '(.+)'$/, '$1'))
        expect(ignored).toEqual(webOnlyPaths)
    })

    it('fetches a main tip that a shallow checkout does not have', () => {
        const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'release-source-guard-clone-'))
        try {
            git(repo.dir, 'branch', '-f', 'release', repo.source)
            git(clone, 'clone', '-q', '--depth', '1', '--branch', 'release', `file://${repo.dir}`, '.')
            expect(
                spawnSync('git', ['cat-file', '-e', `${repo.secondContent}^{commit}`], { cwd: clone }).status
            ).not.toBe(0)

            expect(guard(clone, repo.source, repo.secondContent).status).toBe(0)
            expect(guard(clone, repo.source, repo.contentThenCode).status).toBe(1)
        } finally {
            fs.rmSync(clone, { recursive: true, force: true })
        }
    })
})
