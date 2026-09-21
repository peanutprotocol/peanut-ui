const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '..', '..')
const SCRIPT_NAME = 'release-version.mjs'
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', SCRIPT_NAME)

// The script is a CI entrypoint: its contract is stdout + exit code, so run it
// the way the workflows do instead of reaching into its internals. CI checks this
// repo out shallow and the tag list is the whole input, so every case gets its
// own repo with a known history rather than asserting against the checkout.
function makeRepo(version, { commits = 3, tags = [] } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-version-'))
    fs.mkdirSync(path.join(dir, 'scripts'))
    fs.copyFileSync(SCRIPT_PATH, path.join(dir, 'scripts', SCRIPT_NAME))
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }))
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
    git('init', '-q')
    // Hermetic against a developer's global signing config: commit.gpgsign /
    // tag.gpgsign turn these into signed objects and fail without a key.
    git('config', 'commit.gpgsign', 'false')
    git('config', 'tag.gpgsign', 'false')
    for (let i = 0; i < commits; i++) {
        git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', `c${i}`)
    }
    tags.forEach((tag) => {
        if (/^v\d+\.[1-9]\d*\.0$/.test(tag)) {
            git('-c', 'user.email=t@t', '-c', 'user.name=t', 'tag', '-a', tag, '-m', `Native release ${tag.slice(1)}`)
        } else git('tag', tag)
    })
    return dir
}

// `--depth` is silently ignored on plain-path local clones, hence file://.
function makeShallowClone(sourceDir, depth) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-version-shallow-'))
    execFileSync('git', ['clone', '-q', '--depth', String(depth), `file://${sourceDir}`, dir], { stdio: 'ignore' })
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    fs.copyFileSync(SCRIPT_PATH, path.join(dir, 'scripts', SCRIPT_NAME))
    fs.copyFileSync(path.join(sourceDir, 'package.json'), path.join(dir, 'package.json'))
    return dir
}

function run(dir, args) {
    return spawnSync(process.execPath, [path.join(dir, 'scripts', SCRIPT_NAME), ...args], {
        cwd: dir,
        encoding: 'utf-8',
    })
}

describe('release version resolver', () => {
    const repos = []
    afterAll(() => repos.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))

    function repo(version, options) {
        const dir = makeRepo(version, options)
        repos.push(dir)
        return dir
    }

    describe('native', () => {
        it('bumps the build component and resets the OTA component', () => {
            const result = run(repo('1.0.53', { tags: ['v1.4.0', 'v1.4.2', 'v1.3.0'] }), ['native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.5.0')
        })

        // The migration case: no v1.<build>.0 tag but v1.0.0, so the first release
        // under the new scheme is 1.1.0 with nothing to seed by hand.
        it('starts at .1 when no build tag exists for this major', () => {
            const result = run(repo('1.0.53', { tags: ['v1.0.0', 'v1.0.52'] }), ['native'])

            expect(result.stdout.trim()).toBe('1.1.0')
        })

        it('counts only tags matching the major package.json declares', () => {
            const result = run(repo('2.0.0', { tags: ['v1.9.0', 'v2.2.0'] }), ['native'])

            expect(result.stdout.trim()).toBe('2.3.0')
        })

        // A tagless checkout would silently resolve build 1 forever, re-shipping one
        // version — the tag list is the registry, so its absence is an error.
        it('fails on a checkout with no tags rather than restarting the count', () => {
            const result = run(repo('1.0.53', { tags: [] }), ['native'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/fetch-depth/)
        })
    })

    describe('ota', () => {
        it('advances beyond shipped tags after channels are reset to builtin', () => {
            const result = run(repo('1.0.53', { tags: ['v1.6.0', 'ota-1.6.2'] }), ['ota', '--current', 'builtin'])
            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.6.3')
        })
        it('advances after a partial platform upload', () => {
            const result = run(repo('1.0.53', { tags: ['v1.6.0', 'ota-1.6.2'] }), ['ota', '--current', '1.6.3-ios'])
            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.6.4')
        })

        it('increments the OTA component within the current build', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['ota', '--current', '1.5.3'])

            expect(result.stdout.trim()).toBe('1.5.4')
        })

        // Capgo drops any bundle sorting below the installed binary, so an OTA lane
        // left behind by a fresh native build has to jump to that build, not keep
        // counting under the old one (TASK-21793).
        it('jumps to the newest build when the channel is behind it', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0', 'v1.6.0'] }), ['ota', '--current', '1.5.3'])

            expect(result.stdout.trim()).toBe('1.6.1')
        })

        it('clears a prerelease left over from the old hotfix-tag scheme', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['ota', '--current', '1.5.2-hotfix1'])

            expect(result.stdout.trim()).toBe('1.5.3')
        })

        it('refuses when the channel is ahead of every native build', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['ota', '--current', '1.6.0'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/ahead of the newest native build/)
        })

        it('refuses before any native release exists', () => {
            const result = run(repo('1.0.53', { tags: ['v1.0.0'] }), ['ota', '--current', '1.0.54'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/cut a native release/)
        })
    })

    describe('staging', () => {
        // The commit count is what keeps staging and production out of each other's
        // bundle namespace; the build component is what keeps staging above the
        // binary once a native release ships.
        it('rides the current build with the commit count as its OTA component', () => {
            const result = run(repo('1.0.53', { commits: 12, tags: ['v1.5.0'] }), ['staging'])

            expect(result.stdout.trim()).toBe('1.5.12')
        })

        it('fails on a shallow clone instead of shipping a version under the binary', () => {
            const dir = makeShallowClone(repo('1.0.53', { commits: 5, tags: ['v1.5.0'] }), 2)
            repos.push(dir)
            const result = run(dir, ['staging'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/shallow clone/)
        })
    })

    describe('native-floor', () => {
        // Only v<major>.<build>.0 tags are native releases: OTA tags, another major
        // and the off-scheme v2026.02.26 on main must not become a floor.
        it('picks the newest native release tag', () => {
            const result = run(repo('1.0.53', { tags: ['v1.4.0', 'v1.4.2', 'v1.3.0', 'v2.1.0', 'v2026.02.26'] }), [
                'native-floor',
            ])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.4.0')
        })

        // A missing floor would upload a bundle every shell accepts, including the
        // ones it was not built for — fail the lane instead.
        it('fails when no native release tag exists', () => {
            const result = run(repo('1.0.53', { tags: ['v1.0.0', 'v2026.02.26'] }), ['native-floor'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/cut a native release/)
        })
    })

    /*
     * newest-native is the provenance input for both production release
     * workflows: it answers "the release this commit must contain". Unlike
     * native-floor it deliberately ignores package.json's major, because the
     * first release of a new major has no floor and skipping the check there is
     * what would let a lagging ref build 2.1.0 without containing v1.6.0.
     */
    describe('newest-native', () => {
        it('does not hide a newer major from a stale release ref', () => {
            const dir = repo('1.0.53', { tags: ['v1.6.0'] })
            const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
            git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--allow-empty', '-m', 'new major')
            git('-c', 'user.email=t@t', '-c', 'user.name=t', 'tag', '-a', 'v2.1.0', '-m', 'Native release 2.1.0')
            git('checkout', '--detach', 'HEAD~1')
            const result = run(dir, ['newest-native'])
            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('2.1.0')
            expect(
                spawnSync('git', ['merge-base', '--is-ancestor', `v${result.stdout.trim()}`, 'HEAD'], { cwd: dir })
                    .status
            ).toBe(1)
        })

        it('picks the newest attested native release across majors', () => {
            const result = run(repo('2.0.0', { tags: ['v1.4.0', 'v1.6.0', 'v1.5.0', 'v2.1.0'] }), ['newest-native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('2.1.0')
        })

        // The load-bearing case: package.json has moved to a major with no tag
        // yet. native-floor has no answer here and the guard would skip; this
        // must still name v1.6.0 as the release the commit has to contain.
        it('answers for a major that has no release of its own yet', () => {
            const result = run(repo('2.0.0', { tags: ['v1.5.0', 'v1.6.0'] }), ['newest-native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.6.0')
        })

        it('orders builds numerically, not lexically', () => {
            const result = run(repo('1.0.53', { tags: ['v1.9.0', 'v1.10.0'] }), ['newest-native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.10.0')
        })

        // Same exclusions as native-floor: an OTA tag and the date-shaped
        // v2026.02.26 that really is on main are not native releases.
        it('ignores tags that are not native releases', () => {
            const result = run(repo('1.0.53', { tags: ['v1.6.0', 'v1.6.3', 'v2026.02.26'] }), ['newest-native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.6.0')
        })

        // `v*` is loose enough that a date-shaped tag can match the release
        // pattern exactly. Unbounded, v2026.02.0 would become the newest release
        // and demand every ref contain a tag that never shipped a binary.
        it('ignores a date-shaped tag that does match the release pattern', () => {
            const result = run(repo('1.0.53', { tags: ['v1.6.0', 'v2026.02.0'] }), ['newest-native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.6.0')
        })

        it('ignores an unrelated canonical-looking tag without release metadata', () => {
            const dir = repo('1.0.53', { tags: ['v1.6.0'] })
            execFileSync(
                'git',
                ['-c', 'user.email=t@t', '-c', 'user.name=t', 'tag', '-a', 'v2026.2.0', '-m', 'Website snapshot'],
                { cwd: dir }
            )
            expect(run(dir, ['newest-native']).stdout.trim()).toBe('1.6.0')
        })

        it('returns an empty success only for an explicitly allowed empty registry', () => {
            const result = run(repo('1.0.53'), ['newest-native', '--allow-none'])
            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('')
        })

        it('does not mistake an unreadable registry for the first release', () => {
            const dir = repo('1.0.53', { tags: ['v1.6.0'] })
            fs.renameSync(path.join(dir, '.git'), path.join(dir, 'hidden-git'))
            expect(run(dir, ['newest-native', '--allow-none']).status).toBe(1)
        })

        it('rejects shallow history even when no prior release is allowed', () => {
            const dir = makeShallowClone(repo('1.0.53', { tags: ['v1.6.0'] }), 1)
            repos.push(dir)
            const result = run(dir, ['newest-native', '--allow-none'])
            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/fetch-depth/)
        })

        it('fails when the repository has no native release at all', () => {
            const result = run(repo('1.0.53', { tags: ['v1.0.1', 'v1.0.2'] }), ['newest-native'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/no attested v<major>\.<build>\.0 native release/)
        })
    })

    describe('native workflow provenance guard', () => {
        const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release-native.yml'), 'utf8')
        const guard = workflow
            .split('- name: Guard release provenance')[1]
            .split('- name: Resolve next build version')[0]
            .split('run: |')[1]
            .split('\n')
            .map((line) => line.replace(/^ {18}/, ''))
            .join('\n')
        const execute = (dir) =>
            spawnSync('bash', ['-euo', 'pipefail', '-c', guard], {
                cwd: dir,
                env: { ...process.env, GITHUB_REF_NAME: 'dev', GITHUB_SHA: 'a'.repeat(40) },
                encoding: 'utf8',
            })
        it('accepts a verified empty release registry for the first native release', () => {
            expect(execute(repo('1.0.53')).status).toBe(0)
        })
        it('does not turn a broken resolver into permission to publish', () => {
            const dir = repo('1.0.53', { tags: ['v1.6.0'] })
            fs.writeFileSync(path.join(dir, 'package.json'), 'invalid JSON')
            expect(execute(dir).status).not.toBe(0)
        })
    })

    describe('validate', () => {
        // `v*` is too loose a glob to reject this, and v2026.02.26 is a real tag on
        // main — it is X.Y.Z shaped, so only the major check catches it.
        it('rejects an off-scheme tag that happens to be X.Y.Z shaped', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['validate', '2026.02.26', '--kind', 'native'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/major 2026/)
        })

        it('rejects a native release that does not end in .0', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['validate', '1.5.3', '--kind', 'native'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/must end in \.0/)
        })

        it('rejects an OTA that collides with the JS baked into a binary', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['validate', '1.5.0', '--kind', 'ota'])

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(/baked into a binary/)
        })

        it('passes a well-formed version through', () => {
            const result = run(repo('1.0.53', { tags: ['v1.5.0'] }), ['validate', '1.6.0', '--kind', 'native'])

            expect(result.status).toBe(0)
            expect(result.stdout.trim()).toBe('1.6.0')
        })
    })
})
