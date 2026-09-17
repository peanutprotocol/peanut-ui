/**
 * public/client-support.json is a derived file: the CI check must reject a
 * snapshot that drifted from the pinned registry, a registry that is not the
 * pinned one, and a malformed source — while `sync` produces exactly the
 * policy mono's `cli.mjs policy` would.
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SCRIPT = path.join(__dirname, '..', 'client-support-policy.mjs')
const MONO_SHA = '99c3e3fe13f8b6b309d9d5aafd85573c17722457'

const ZERO_REGISTRY = {
    schemaVersion: 1,
    observationDays: 7,
    minimumGeneration: { web: 0, ios: 0, android: 0 },
    releases: [],
    changes: [],
}

function makeRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'client-support-'))
    fs.mkdirSync(path.join(root, 'public'))
    fs.mkdirSync(path.join(root, 'scripts'))
    return root
}

function writeRegistry(root, registry) {
    const file = path.join(root, 'registry.json')
    fs.writeFileSync(file, JSON.stringify(registry))
    return file
}

function run(root, ...args) {
    return spawnSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8' })
}

function readJson(root, rel) {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
}

describe('client-support-policy sync', () => {
    it('writes the exact public schema and a lock that pins the source without copying it', () => {
        const root = makeRoot()
        const registry = writeRegistry(root, { ...ZERO_REGISTRY, minimumGeneration: { web: 0, ios: 2, android: 1 } })

        const result = run(root, 'sync', '--registry', registry, '--mono-sha', MONO_SHA)

        expect(result.status).toBe(0)
        expect(readJson(root, 'public/client-support.json')).toEqual({
            schemaVersion: 1,
            minimumGeneration: { web: 0, ios: 2, android: 1 },
        })
        const lock = readJson(root, 'scripts/client-support-policy.lock.json')
        expect(lock.monoSha).toBe(MONO_SHA)
        expect(lock.registryPath).toBe('engineering/compatibility/registry.json')
        expect(lock.registrySha256).toMatch(/^[a-f0-9]{64}$/)
        // nothing private leaks: no releases, changes, tasks or owners in the lock
        expect(JSON.stringify(lock)).not.toMatch(/releases|changes|observationDays/)
    })

    it('refuses a registry it cannot derive a policy from', () => {
        const root = makeRoot()
        const registry = writeRegistry(root, { ...ZERO_REGISTRY, minimumGeneration: { web: -1, ios: 0, android: 0 } })

        const result = run(root, 'sync', '--registry', registry, '--mono-sha', MONO_SHA)

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('web floor')
    })

    it('refuses a short or missing mono sha', () => {
        const root = makeRoot()
        const registry = writeRegistry(root, ZERO_REGISTRY)

        expect(run(root, 'sync', '--registry', registry, '--mono-sha', '99c3e3f').status).toBe(1)
        expect(run(root, 'sync', '--registry', registry).status).toBe(1)
    })
})

describe('client-support-policy check', () => {
    function synced(registryOverrides = {}) {
        const root = makeRoot()
        const registry = writeRegistry(root, { ...ZERO_REGISTRY, ...registryOverrides })
        expect(run(root, 'sync', '--registry', registry, '--mono-sha', MONO_SHA).status).toBe(0)
        return { root, registry }
    }

    it('passes when the snapshot is what the pinned registry derives', () => {
        const { root, registry } = synced()
        const result = run(root, 'check', '--registry', registry)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('matches mono 99c3e3f')
    })

    it('fails when the snapshot drifted from the pinned registry', () => {
        const { root, registry } = synced()
        fs.writeFileSync(
            path.join(root, 'public/client-support.json'),
            JSON.stringify({ schemaVersion: 1, minimumGeneration: { web: 0, ios: 0, android: 5 } })
        )
        const result = run(root, 'check', '--registry', registry)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('not the policy the pinned registry derives')
    })

    it('fails when the registry handed in is not the one the lock pinned', () => {
        const { root } = synced()
        const other = writeRegistry(root, { ...ZERO_REGISTRY, minimumGeneration: { web: 1, ios: 0, android: 0 } })
        const result = run(root, 'check', '--registry', other)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('does not match the lock')
    })

    it('fails on a snapshot that carries anything beyond the public schema', () => {
        const { root, registry } = synced()
        fs.writeFileSync(
            path.join(root, 'public/client-support.json'),
            JSON.stringify({ schemaVersion: 1, minimumGeneration: { web: 0, ios: 0, android: 0 }, releases: [] })
        )
        const result = run(root, 'check', '--registry', registry)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('exactly { schemaVersion: 1, minimumGeneration }')
    })

    it('fails on a malformed registry', () => {
        const { root } = synced()
        const broken = writeRegistry(root, { schemaVersion: 2 })
        const result = run(root, 'check', '--registry', broken)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('client-support-policy')
    })

    it('refuses to pass with no source to compare against', () => {
        const { root } = synced()
        const result = run(root, 'check')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('needs the pinned source')
    })

    describe('against a proof (what CI carries between jobs instead of the private registry)', () => {
        function proofFor(root, registry, monoSha = MONO_SHA) {
            const out = path.join(root, 'proof.json')
            const result = run(root, 'proof', '--registry', registry, '--mono-sha', monoSha, '--out', out)
            expect(result.status).toBe(0)
            return out
        }

        it('carries the policy, pin and digest and nothing private', () => {
            const { root, registry } = synced()
            proofFor(root, registry)
            const proof = readJson(root, 'proof.json')
            expect(Object.keys(proof).sort()).toEqual(['monoSha', 'policy', 'registrySha256', 'schemaVersion'])
            expect(proof.policy).toEqual({ schemaVersion: 1, minimumGeneration: { web: 0, ios: 0, android: 0 } })
            expect(proof.registrySha256).toBe(readJson(root, 'scripts/client-support-policy.lock.json').registrySha256)
        })

        it('passes when the proof matches the lock and the snapshot', () => {
            const { root, registry } = synced()
            const result = run(root, 'check', '--proof', proofFor(root, registry))
            expect(result.status).toBe(0)
            expect(result.stdout).toContain('matches mono 99c3e3f')
        })

        it('fails when the proof pins a different mono commit', () => {
            const { root, registry } = synced()
            const proof = proofFor(root, registry, 'a'.repeat(40))
            const result = run(root, 'check', '--proof', proof)
            expect(result.status).toBe(1)
            expect(result.stderr).toContain('the lock pins')
        })

        it('fails when the proof digest is not the locked registry', () => {
            const { root } = synced()
            const other = writeRegistry(root, { ...ZERO_REGISTRY, minimumGeneration: { web: 0, ios: 0, android: 3 } })
            const result = run(root, 'check', '--proof', proofFor(root, other))
            expect(result.status).toBe(1)
            expect(result.stderr).toContain('does not match the lock')
        })

        it('fails on a tampered proof policy even with the right pin and digest', () => {
            const { root, registry } = synced()
            const proofPath = proofFor(root, registry)
            const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'))
            proof.policy.minimumGeneration.web = 7
            fs.writeFileSync(proofPath, JSON.stringify(proof))
            const result = run(root, 'check', '--proof', proofPath)
            expect(result.status).toBe(1)
            expect(result.stderr).toContain('not the policy the pinned registry derives')
        })

        it('fails on a proof that smuggles registry fields or is malformed', () => {
            const { root, registry } = synced()
            const proofPath = proofFor(root, registry)
            const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'))
            fs.writeFileSync(proofPath, JSON.stringify({ ...proof, releases: [] }))
            expect(run(root, 'check', '--proof', proofPath).status).toBe(1)
            fs.writeFileSync(proofPath, '{')
            expect(run(root, 'check', '--proof', proofPath).status).toBe(1)
            expect(run(root, 'check', '--proof', path.join(root, 'missing.json')).status).toBe(1)
        })

        describe('CI refuses a pin that mono main does not contain', () => {
            // The credential-holding job verifies ancestry with the compare
            // endpoint before it touches the registry. Execute that shell
            // block as written, against a stub `gh` that answers what the
            // test dictates and records what it was asked.
            const workflow = fs.readFileSync(
                path.join(__dirname, '..', '..', '.github', 'workflows', 'tests.yml'),
                'utf8'
            )
            const block = workflow
                .split('# client-support-ancestry-begin\n')[1]
                .split('# client-support-ancestry-end')[0]
                .split('\n')
            const indent = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
            const body = block.map((l) => l.slice(indent)).join('\n')

            function runAncestry({ response, exit = 0 }) {
                const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-support-ancestry-'))
                const stubDir = path.join(dir, 'bin')
                fs.mkdirSync(stubDir)
                const calls = path.join(dir, 'gh-calls.txt')
                fs.writeFileSync(
                    path.join(stubDir, 'gh'),
                    `#!/usr/bin/env bash\nprintf '%s\\n' "token=$GH_TOKEN" "$@" >> "${calls}"\nprintf '%s' "$GH_STUB_RESPONSE"\nexit "$GH_STUB_EXIT"\n`,
                    { mode: 0o755 }
                )
                const script = path.join(dir, 'ancestry.sh')
                fs.writeFileSync(script, `set -euo pipefail\n${body}\necho ancestry-ok\n`)
                const result = spawnSync('bash', [script], {
                    encoding: 'utf8',
                    env: {
                        PATH: `${stubDir}:${process.env.PATH}`,
                        MONO_SHA,
                        MONO_TOKEN: 'stub-mono-token',
                        GH_STUB_RESPONSE: response,
                        GH_STUB_EXIT: String(exit),
                    },
                })
                return { ...result, calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '' }
            }

            it('asks mono for base=pin, head=main with the mono token, and passes when main is ahead', () => {
                const result = runAncestry({ response: `ahead ${MONO_SHA}` })
                expect(result.stderr).toBe('')
                expect(result.status).toBe(0)
                expect(result.stdout).toContain('ancestry-ok')
                expect(result.calls).toContain('token=stub-mono-token')
                expect(result.calls).toContain(`repos/peanutprotocol/mono/compare/${MONO_SHA}...main`)
                expect(result.calls).toContain('{{.status}} {{.merge_base_commit.sha}}')
            })

            it('passes when the pin is main itself', () => {
                const result = runAncestry({ response: `identical ${MONO_SHA}` })
                expect(result.status).toBe(0)
            })

            it.each([
                ['behind', `behind ${'b'.repeat(40)}`],
                ['diverged', `diverged ${'b'.repeat(40)}`],
                ['unknown', `unknown ${MONO_SHA}`],
                ['an empty answer', ''],
                ['a malformed answer', '<no value> <no value>'],
                ['a matching status but a foreign merge base', `ahead ${'c'.repeat(40)}`],
            ])('rejects %s and names the operator fix', (_label, response) => {
                const result = runAncestry({ response })
                expect(result.status).toBe(1)
                expect(result.stdout).toContain('::error::')
                expect(result.stdout).toContain('Merge the mono PR')
                expect(result.stdout).not.toContain('ancestry-ok')
                // no commit data beyond the pin itself reaches the log
                expect(result.stdout).not.toContain('b'.repeat(40))
                expect(result.stdout).not.toContain('c'.repeat(40))
            })

            it('rejects a failed API call instead of assuming ancestry', () => {
                const result = runAncestry({ response: '', exit: 22 })
                expect(result.status).toBe(1)
                expect(result.stdout).toContain('::error::Could not compare mono')
                expect(result.stdout).not.toContain('ancestry-ok')
            })
        })

        it('is what the CI source job derives inline, byte for byte', () => {
            // The credential-holding job cannot run PR code, so it carries its
            // own copy of the derivation. Execute that copy and compare it
            // with the script's proof, so the two cannot drift apart.
            const workflow = fs.readFileSync(
                path.join(__dirname, '..', '..', '.github', 'workflows', 'tests.yml'),
                'utf8'
            )
            const block = workflow.split('# client-support-proof-begin\n')[1].split('# client-support-proof-end')[0]
            const lines = block.split('\n').slice(1) // drop the `cat > … <<'PROOF'` line
            const body = lines.slice(
                0,
                lines.findIndex((line) => line.trim() === 'PROOF')
            )
            const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
            const { root, registry } = synced({ minimumGeneration: { web: 1, ios: 2, android: 0 } })
            const inline = path.join(root, 'derive-proof.mjs')
            fs.writeFileSync(inline, body.map((l) => l.slice(indent)).join('\n'))
            const proofFromWorkflow = path.join(root, 'workflow-proof.json')
            const derived = spawnSync(process.execPath, [inline], {
                encoding: 'utf8',
                env: { ...process.env, REGISTRY_FILE: registry, MONO_SHA, PROOF_FILE: proofFromWorkflow },
            })
            expect(derived.status).toBe(0)
            expect(fs.readFileSync(proofFromWorkflow, 'utf8')).toBe(fs.readFileSync(proofFor(root, registry), 'utf8'))
            expect(run(root, 'check', '--proof', proofFromWorkflow).status).toBe(0)
        })
    })

    it('agrees with the checked-in snapshot and lock of this repository', () => {
        // The pinned mono commit carries the initial (empty, all-zero) registry;
        // a proof derived from that registry must satisfy the committed lock.
        const repoRoot = path.join(__dirname, '..', '..')
        const scratch = makeRoot()
        const registry = writeRegistry(scratch, ZERO_REGISTRY)
        const proof = path.join(scratch, 'proof.json')
        expect(run(scratch, 'proof', '--registry', registry, '--mono-sha', MONO_SHA, '--out', proof).status).toBe(0)
        const result = spawnSync(process.execPath, [SCRIPT, 'check', '--proof', proof, '--root', repoRoot], {
            encoding: 'utf8',
        })
        expect(result.stderr).toBe('')
        expect(result.status).toBe(0)
        // Groundwork: every floor is zero, so no client is asked to update yet.
        expect(readJson(repoRoot, 'public/client-support.json')).toEqual({
            schemaVersion: 1,
            minimumGeneration: { web: 0, ios: 0, android: 0 },
        })
        expect(readJson(repoRoot, 'scripts/client-support-policy.lock.json').monoSha).toBe(MONO_SHA)
    })
})
