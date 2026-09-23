/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows')

// Execute only the branch guard, never the version resolver or deployment steps.
function guardOf(file) {
    const workflow = fs.readFileSync(path.join(workflowsDir, file), 'utf8')
    if (file === 'release-ota.yml') {
        const step = workflow.slice(workflow.indexOf('- name: Guard release ref'))
        return step
            .match(/run: \|\n([\s\S]*?)\n\s+- name: Check out release tooling/)[1]
            .split('\n')
            .map((line) => line.replace(/^ {18}/, ''))
            .join('\n')
    }
    return workflow.match(/if \[ "\$GITHUB_REF_NAME"[^\n]+; then\n[\s\S]*?\n\s+fi/)[0]
}

function run(guard, branch, event = 'workflow_dispatch') {
    return spawnSync('bash', ['-eu', '-c', guard], {
        env: { ...process.env, GITHUB_REF_NAME: branch, GITHUB_EVENT_NAME: event },
        encoding: 'utf8',
    })
}

function promotionShell() {
    const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
    const step = workflow.indexOf('- name: Promote verified bundles to platform production')
    const runStart = workflow.indexOf('run: |', step)
    const nextStep = workflow.indexOf('\n            - name:', runStart)
    return workflow
        .slice(runStart + 'run: |\n'.length, nextStep)
        .split('\n')
        .map((line) => line.replace(/^ {18}/, ''))
        .join('\n')
}

function floorShell() {
    const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
    const step = workflow.indexOf('- name: Resolve per-platform OTA floors')
    const runStart = workflow.indexOf('run: |', step)
    const nextStep = workflow.indexOf('\n            - name:', runStart)
    return workflow
        .slice(runStart + 'run: |\n'.length, nextStep)
        .split('\n')
        .map((line) => line.replace(/^ {18}/, ''))
        .join('\n')
}

function runFloors(bridgeActive) {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ota-main-floors-'))
    const output = path.join(dir, 'output')
    const script = `
        node() {
            case "$*" in
                *native-floor*) printf '1.6.0\\n';;
                *'--platform android'*) printf '1.6.0\\n';;
                *'--platform ios'*) printf '1.5.0\\n';;
                *) return 1;;
            esac
        }
        pnpm() { :; }
        ${floorShell()}
    `
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
        encoding: 'utf8',
        env: { ...process.env, BRIDGE_ACTIVE: bridgeActive ? 'active' : 'inactive', GITHUB_OUTPUT: output },
    })
    const floors = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : ''
    fs.rmSync(dir, { recursive: true, force: true })
    return { status: result.status, floors }
}

function runPromotion({ firstMainSha, staleAfterFirst = false }) {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ota-main-guard-'))
    const gitCalls = path.join(dir, 'git-calls')
    const nodeCalls = path.join(dir, 'node-calls')
    const expectedMainSha = 'a'.repeat(40)
    const staleMainSha = 'b'.repeat(40)
    const script = `
        git() {
            if [ "$1" = "ls-remote" ]; then
                COUNT=0
                if [ -f "$GIT_CALLS_FILE" ]; then COUNT="$(cat "$GIT_CALLS_FILE")"; fi
                COUNT=$((COUNT + 1))
                printf '%s' "$COUNT" > "$GIT_CALLS_FILE"
                if [ "$COUNT" -eq 1 ]; then
                    printf '%s\\trefs/heads/main\\n' "$FIRST_MAIN_SHA"
                elif [ "$STALE_AFTER_FIRST" = true ]; then
                    printf '%s\\trefs/heads/main\\n' "$STALE_MAIN_SHA"
                else
                    printf '%s\\trefs/heads/main\\n' "$EXPECTED_MAIN_SHA"
                fi
            else
                command git "$@"
            fi
        }
        node() { printf '%s\\n' "$*" >> "$NODE_CALLS_FILE"; }
        ${promotionShell()}
    `
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
        encoding: 'utf8',
        env: {
            ...process.env,
            RELEASE_VERSION: '1.6.4',
            RELEASE_VERSION_IOS: '1.6.4-ios',
            BRIDGE_ACTIVE: 'inactive',
            FLOOR_ANDROID: '1.6.0',
            FLOOR_IOS: '1.5.0',
            EXPECTED_MAIN_SHA: expectedMainSha,
            FIRST_MAIN_SHA: firstMainSha,
            STALE_MAIN_SHA: staleMainSha,
            STALE_AFTER_FIRST: String(staleAfterFirst),
            GIT_CALLS_FILE: gitCalls,
            NODE_CALLS_FILE: nodeCalls,
        },
    })
    const calls = fs.existsSync(nodeCalls) ? fs.readFileSync(nodeCalls, 'utf8').trim().split('\n').filter(Boolean) : []
    fs.rmSync(dir, { recursive: true, force: true })
    return { ...result, calls }
}

/*
 * A production OTA reaches every shipped install, and there is exactly one ref
 * it may come from. `dev` and `main` both looked shippable at dispatch time and
 * the older one was picked — bundle 1.6.1 went out from a `main` two days behind
 * the v1.6.0 release. Merging to `main` is now the decision to ship; `dev` goes
 * to staging, which no production device sees.
 */
describe('release-ota.yml publishes main source', () => {
    const guard = guardOf('release-ota.yml')

    it('accepts a main push and a manual dispatch of dev tooling', () => {
        expect(run(guard, 'main', 'push').status).toBe(0)
        expect(run(guard, 'dev', 'workflow_dispatch').status).toBe(0)
    })

    it.each([
        ['main', 'workflow_dispatch'],
        ['dev', 'push'],
        ['release/android-kyc', 'workflow_dispatch'],
        ['feature/kyc', 'push'],
        ['', 'workflow_dispatch'],
    ])('refuses %s on %s', (branch, event) => {
        const result = run(guard, branch, event)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })

    it('auto-runs only on main pushes and manually runs dev tooling against main source', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        expect(workflow).toMatch(/push:\n\s+branches: \[main\]/)
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).toContain("github.event_name == 'workflow_dispatch' && 'main' || github.sha")
        expect(workflow).toContain('source_sha: ${{ steps.source.outputs.sha }}')
        expect(workflow).toContain('ref: ${{ needs.resolve.outputs.source_sha }}')
        expect(workflow).toContain('path: app')
        expect(workflow).toContain('path: release-tooling')
        expect(workflow).toContain('OTA_SOURCE_SHA: ${{ needs.resolve.outputs.source_sha }}')
    })

    it('holds the iOS delivery floor until the bridge is active', () => {
        expect(runFloors(false)).toEqual({ status: 0, floors: 'android=1.6.0\nios=1.6.0\n' })
        expect(runFloors(true)).toEqual({ status: 0, floors: 'android=1.6.0\nios=1.5.0\n' })
    })

    it('rechecks main after the build and immediately before each platform promotion', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        const afterBuild = workflow.indexOf('- name: Guard current main after build')
        const build = workflow.indexOf('- name: Build native static export')
        const verifyBundles = workflow.indexOf('- name: Verify the floors reached the bundles')
        const promotion = workflow.indexOf('- name: Promote verified bundles to platform production')
        const perPlatformGuard = workflow.indexOf('guard_current_main\n                    # Bundle selection')

        expect(build).toBeLessThan(afterBuild)
        expect(afterBuild).toBeLessThan(verifyBundles)
        expect(verifyBundles).toBeLessThan(promotion)
        expect(perPlatformGuard).toBeGreaterThan(promotion)
        expect(workflow.match(/git ls-remote origin refs\/heads\/main/g)).toHaveLength(3)
        expect(workflow).toContain('EXPECTED_MAIN_SHA: ${{ needs.resolve.outputs.source_sha }}')
        expect(workflow).toContain('guard_current_main\n                    # Bundle selection and rollout disablement')
    })

    it('stops before any Capgo mutation when main advanced before the first platform', () => {
        const result = runPromotion({ firstMainSha: 'b'.repeat(40) })

        expect(result.status).toBe(1)
        expect(result.calls).toEqual([])
    })

    it('stops before the second platform when main advances between promotions', () => {
        const result = runPromotion({ firstMainSha: 'a'.repeat(40), staleAfterFirst: true })

        expect(result.status).toBe(1)
        expect(result.calls.filter((call) => call.includes('promote-production'))).toHaveLength(1)
        expect(result.calls.filter((call) => call.includes('verify-production'))).toHaveLength(1)
    })
})

// The native lanes still cut releases from dev; unchanged, and deliberately so.
describe.each(['release-native.yml', 'android-release.yml'])('%s release branches', (file) => {
    const guard = guardOf(file)

    it.each(['dev', 'main', 'release/android-kyc'])('accepts %s', (branch) => {
        expect(run(guard, branch).status).toBe(0)
    })

    it.each(['feature/kyc', 'release/other', 'main-fix', ''])('rejects unrelated branch %s', (branch) => {
        const result = run(guard, branch)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })
})
