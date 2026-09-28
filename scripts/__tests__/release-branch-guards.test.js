/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows')

// Execute only the branch guard, never the version resolver or deployment steps.
function guardOf(file) {
    const workflow = fs.readFileSync(path.join(workflowsDir, file), 'utf8')
    if (file === 'release-ota.yml' || file === 'release-native.yml') {
        const step = workflow.slice(workflow.indexOf('- name: Guard release ref'))
        return step
            .match(
                /run: \|\n([\s\S]*?)\n\s+- (?:name: (?:Check out release tooling|Read native-incompatible OTA evidence)|uses: actions\/checkout)/
            )[1]
            .split('\n')
            .map((line) => line.replace(/^ {18}/, ''))
            .join('\n')
    }
    return workflow.match(/if \[ "\$GITHUB_REF_NAME"[^\n]+; then\n[\s\S]*?\n\s+fi/)[0]
}

function run(guard, branch, event = 'workflow_dispatch') {
    return spawnSync('bash', ['-eu', '-c', guard], {
        env: {
            ...process.env,
            GITHUB_REF_NAME: branch,
            GITHUB_EVENT_NAME: event,
            GITHUB_SHA: 'a'.repeat(40),
            OTA_SOURCE_SHA: 'a'.repeat(40),
        },
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

function nativeCompatibilityShell() {
    const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
    const step = workflow.indexOf('- name: Preflight OTA native compatibility')
    const runStart = workflow.indexOf('run: |', step)
    const nextStep = workflow.indexOf('\n            - name:', runStart)
    return workflow
        .slice(runStart + 'run: |\n'.length, nextStep)
        .split('\n')
        .map((line) => line.replace(/^ {18}/, ''))
        .join('\n')
}

function runNativeCompatibility(failure) {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ota-native-compat-'))
    const script = `
        node() {
            if [[ "$*" == *newest-native* ]]; then printf '1.6.0\\n'; return; fi
            if [ "$2" = 'v1.6.0' ] && [ "$4" = android ]; then
                if [ "$COMPAT_FAILURE" = drift ]; then
                    echo "this tree's native surface differs from v1.6.0" >&2
                    return 1
                fi
                if [ "$COMPAT_FAILURE" = unrelated ]; then
                    echo 'tag verification failed' >&2
                    return 1
                fi
            fi
            echo 'native surface matches'
        }
        ${nativeCompatibilityShell()}
    `
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
        encoding: 'utf8',
        env: { ...process.env, RUNNER_TEMP: dir, OTA_SOURCE_SHA: 'a'.repeat(40), COMPAT_FAILURE: failure },
    })
    const markerPath = path.join(dir, 'ota-native-incompatible', 'head.sha')
    const marker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8') : null
    fs.rmSync(dir, { recursive: true, force: true })
    return { status: result.status, marker }
}

function runFloors(bridgeActive, androidBridgeActive = false) {
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
        env: {
            ...process.env,
            BRIDGE_ACTIVE: bridgeActive ? 'active' : 'inactive',
            ANDROID_BRIDGE_ACTIVE: androidBridgeActive ? 'active' : 'inactive',
            MIGRATION_CUTOVER: 'false',
            GITHUB_OUTPUT: output,
        },
    })
    const floors = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : ''
    fs.rmSync(dir, { recursive: true, force: true })
    return { status: result.status, floors }
}

function runPromotion({
    firstMainSha,
    staleAfterFirst = false,
    bootstrap = false,
    migration = false,
    iosAlreadyCutOver = false,
}) {
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
            RELEASE_VERSION_ANDROID: '1.6.4-android',
            BRIDGE_ACTIVE: bootstrap ? 'active' : 'inactive',
            ANDROID_BRIDGE_ACTIVE: bootstrap ? 'active' : 'inactive',
            MIGRATION_CUTOVER: migration ? 'true' : 'false',
            IOS_BRIDGE_BEFORE: iosAlreadyCutOver ? 'inactive' : 'active',
            ANDROID_BRIDGE_BEFORE: 'active',
            IOS_BRIDGE_PREVIOUS: bootstrap ? 'inactive' : 'active',
            ANDROID_BRIDGE_PREVIOUS: bootstrap ? 'inactive' : 'active',
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

    it('accepts a main push and a manual dispatch on main', () => {
        expect(run(guard, 'main', 'push').status).toBe(0)
        expect(run(guard, 'main', 'workflow_dispatch').status).toBe(0)
    })

    it.each([
        ['main', 'workflow_run'],
        ['dev', 'workflow_dispatch'],
        ['release/android-kyc', 'workflow_dispatch'],
        ['feature/kyc', 'push'],
        ['', 'workflow_dispatch'],
    ])('refuses %s on %s', (branch, event) => {
        const result = run(guard, branch, event)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })

    it('runs on every main push using that exact main commit for tooling and app source', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        expect(workflow).toMatch(/push:\n\s+branches: \[main\]/)
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow.match(/ref: \$\{\{ github.sha \}\}/g)).toHaveLength(3)
        expect(workflow).toContain('source_sha: ${{ steps.source.outputs.sha }}')
        expect(workflow).toContain('ref: ${{ needs.resolve.outputs.source_sha }}')
        expect(workflow).toContain('path: app')
        expect(workflow).toContain('path: release-tooling')
        expect(workflow).toContain('OTA_SOURCE_SHA: ${{ needs.resolve.outputs.source_sha }}')
    })

    it('holds the iOS delivery floor until the bridge is active', () => {
        expect(runFloors(false)).toEqual({ status: 0, floors: 'android=1.6.0\nios=1.6.0\n' })
        expect(runFloors(true)).toEqual({ status: 0, floors: 'android=1.6.0\nios=1.5.0\n' })
        expect(runFloors(true, true)).toEqual({ status: 0, floors: 'android=1.6.0\nios=1.5.0\n' })
    })

    it('bootstraps both legacy lanes on the first main push', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        expect(workflow).toContain('next-ios-bridge')
        expect(workflow).toContain('next-android-bridge')
        expect(workflow).toContain('migration_cutover=$MIGRATION_CUTOVER')
        expect(workflow).toContain('promote-migration-cutover')
        const result = runPromotion({ firstMainSha: 'a'.repeat(40), bootstrap: true })
        expect(result.status).toBe(0)
        expect(result.calls.filter((call) => call.includes('promote-ios-bridge'))).toHaveLength(1)
        expect(result.calls.filter((call) => call.includes('promote-android-bridge'))).toHaveLength(1)
        expect(result.calls.filter((call) => call.includes('promote-production'))).toHaveLength(0)
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

    it('cuts over each legacy platform and resumes a partially completed cutover', () => {
        const first = runPromotion({ firstMainSha: 'a'.repeat(40), migration: true })
        expect(first.status).toBe(0)
        expect(first.calls.filter((call) => call.includes('promote-migration-cutover'))).toHaveLength(2)

        const resume = runPromotion({ firstMainSha: 'a'.repeat(40), migration: true, iosAlreadyCutOver: true })
        expect(resume.status).toBe(0)
        expect(resume.calls.filter((call) => call.includes('promote-migration-cutover'))).toHaveLength(1)
        expect(resume.calls.filter((call) => call.includes('promote-production'))).toHaveLength(1)
    })
})

function runNative(
    guard,
    branch,
    event,
    { mainTip = 'a'.repeat(40), otaSha = 'a'.repeat(40), runAttempt = '1', otaRunAttempt = '1', otaEvent = 'push' } = {}
) {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'native-guard-'))
    const output = path.join(dir, 'output')
    const script = `
        git() {
            if [ "$1" = "ls-remote" ]; then
                printf '%s\\trefs/heads/main\\n' "$MAIN_TIP"
            else command git "$@"; fi
        }
        ${guard}
    `
    const result = spawnSync('bash', ['-eu', '-c', script], {
        env: {
            ...process.env,
            GITHUB_REF_NAME: branch,
            GITHUB_REF_TYPE: 'branch',
            GITHUB_EVENT_NAME: event,
            GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
            GITHUB_RUN_ATTEMPT: runAttempt,
            GITHUB_SHA: 'a'.repeat(40),
            GITHUB_OUTPUT: output,
            OTA_SOURCE_SHA: otaSha,
            OTA_RUN_ATTEMPT: otaRunAttempt,
            OTA_TRIGGER_EVENT: otaEvent,
            MAIN_TIP: mainTip,
        },
        encoding: 'utf8',
    })
    const outputs = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : ''
    fs.rmSync(dir, { recursive: true, force: true })
    return { ...result, outputs }
}

function runNativeFloor(platform, bridgeStatus) {
    const workflow = fs.readFileSync(path.join(workflowsDir, `${platform}-release.yml`), 'utf8')
    const step = workflow.slice(workflow.indexOf('- name: Check production OTA floor'))
    const shell = step
        .match(/run: \|\n([\s\S]*?)\n\s+- name:/)[1]
        .split('\n')
        .map((line) => line.replace(/^ {18}/, ''))
        .join('\n')
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'native-floor-'))
    const output = path.join(dir, 'output')
    const callsFile = path.join(dir, 'calls')
    const script = `
        node() {
            printf '%s\\n' "$*" >> "$CALLS_FILE"
            case "$*" in
                *bridge-status*) printf '%s\\n' "$BRIDGE_STATUS" ;;
                *current-version*) printf 'builtin\\n' ;;
                *) return 1 ;;
            esac
        }
        ${shell}
    `
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
        env: {
            ...process.env,
            PRERELEASE: 'false',
            BRIDGE_STATUS: bridgeStatus,
            GITHUB_OUTPUT: output,
            CALLS_FILE: callsFile,
        },
        encoding: 'utf8',
    })
    const outputs = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : ''
    const calls = fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8') : ''
    fs.rmSync(dir, { recursive: true, force: true })
    return { ...result, outputs, calls }
}

describe('native release source branch', () => {
    const guard = guardOf('release-native.yml')

    it('accepts only the first main-push OTA completion', () => {
        const result = runNative(guard, 'main', 'workflow_run')
        expect(result.status).toBe(0)
        expect(result.outputs).toBe('')
    })

    it.each([
        ['manual main dispatch', 'main', 'workflow_dispatch', {}],
        ['dev dispatch', 'dev', 'workflow_dispatch', {}],
        ['rerun of native workflow', 'main', 'workflow_run', { runAttempt: '2' }],
        ['rerun of OTA workflow', 'main', 'workflow_run', { otaRunAttempt: '2' }],
        ['manually dispatched OTA', 'main', 'workflow_run', { otaEvent: 'workflow_dispatch' }],
    ])('refuses %s', (_case, branch, event, options) => {
        expect(runNative(guard, branch, event, options).status).toBe(1)
    })

    it('refuses a superseded main commit or an OTA run from another commit', () => {
        expect(runNative(guard, 'main', 'workflow_run', { otaSha: 'b'.repeat(40) }).status).toBe(1)
        const staleMain = runNative(guard, 'main', 'workflow_run', { mainTip: 'b'.repeat(40) })
        expect(staleMain.status).toBe(1)
        expect(staleMain.stderr).toContain('main advanced')
    })

    it.each(['dev', 'release/android-kyc', 'feature/kyc'])('refuses %s', (branch) => {
        const result = runNative(guard, branch, 'workflow_run')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })

    it('has no direct manual or tag-push path into any native build', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-native.yml'), 'utf8')
        expect(workflow).not.toContain('workflow_dispatch:')
        expect(workflow).toContain('github.run_attempt == 1 && github.event.workflow_run.run_attempt == 1')
        expect(workflow).toContain('track: internal')
        expect(workflow.match(/prerelease: false/g)).toHaveLength(2)
        for (const platform of ['ios', 'android']) {
            const callee = fs.readFileSync(path.join(workflowsDir, `${platform}-release.yml`), 'utf8')
            const triggers = callee.slice(callee.indexOf('on:\n'), callee.indexOf('\npermissions:'))
            expect(triggers).toContain('workflow_call:')
            expect(triggers).not.toContain('workflow_dispatch:')
            expect(triggers).not.toContain('push:')
            expect(callee).toContain("github.workflow == 'App Release Android & iOS'")
            expect(callee).toContain("github.event_name == 'workflow_run'")
            expect(callee).toContain('github.run_attempt == 1 && github.event.workflow_run.run_attempt == 1')
        }
    })

    it('only hands success or an attested native-incompatible OTA to the store build', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-native.yml'), 'utf8')
        const otaWorkflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        expect(workflow).toMatch(/workflow_run:\n\s+workflows: \['App Release OTA'\]/)
        expect(workflow).toContain("github.event.workflow_run.event == 'push'")
        expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'")
        expect(workflow).toContain("github.event.workflow_run.conclusion == 'failure'")
        expect(workflow).toContain('name: ota-native-incompatible-${{ github.event.workflow_run.id }}')
        expect(workflow).toContain('run-id: ${{ github.event.workflow_run.id }}')
        expect(workflow).toContain('$(cat ota-native-incompatible/head.sha)" != "$OTA_SOURCE_SHA"')
        expect(otaWorkflow).toContain('name: ota-native-incompatible-${{ github.run_id }}')
        expect(runNativeCompatibility('none')).toEqual({ status: 0, marker: null })
        expect(runNativeCompatibility('drift')).toEqual({ status: 1, marker: `${'a'.repeat(40)}\n` })
        expect(runNativeCompatibility('unrelated')).toEqual({ status: 1, marker: null })
    })

    it('uses one native version and the Play internal track after a permitted main-push OTA', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-native.yml'), 'utf8')
        expect(workflow).toContain('"$GITHUB_SHA" != "$OTA_SOURCE_SHA"')
        expect(workflow).toContain('queue: max')
        expect(workflow).not.toContain('Require compatible production OTA lanes before either store upload')
        expect(workflow).not.toContain('nativeFirst')
        expect(workflow).toContain('track: internal')
        expect(workflow.match(/versionName: \$\{\{ needs.resolve.outputs.version \}\}/g)).toHaveLength(2)
    })

    it.each(['ios', 'android'])('keeps the %s legacy lane during store builds', (platform) => {
        const workflow = fs.readFileSync(path.join(workflowsDir, `${platform}-release.yml`), 'utf8')
        expect(workflow).toContain('run: bash scripts/publish-native-ota.sh')
        expect(workflow).not.toContain('channel currentBundle production')
        expect(workflow).not.toContain('--channel production')
        expect(workflow).toContain('echo "needs_ota=false" >> "$GITHUB_OUTPUT"')
        expect(workflow).not.toContain('nativeFirst')
    })

    it.each(['ios', 'android'])('builds %s after an incompatible OTA without moving its old channel', (platform) => {
        const legacy = runNativeFloor(platform, 'active')
        expect(legacy.status).toBe(0)
        expect(legacy.outputs).toBe('needs_ota=false\n')
        expect(legacy.calls).not.toContain('check-native-ota-surface')

        const nativeFloored = runNativeFloor(platform, 'inactive')
        expect(nativeFloored.status).toBe(0)
        expect(nativeFloored.outputs).toBe('needs_ota=true\n')
    })
})

it.each([
    ['ios', 'v1.5.0'],
    ['android', 'v1.6.0'],
])('the %s recovery bridge pins main and checks its shipped native surface', (platform, base) => {
    const workflow = fs.readFileSync(path.join(workflowsDir, `release-${platform}-legacy-bridge.yml`), 'utf8')
    expect(workflow).toContain('ref: ${{ github.sha }}')
    expect(workflow).toContain('git ls-remote origin refs/heads/main')
    expect(workflow).toContain(`check-native-ota-surface.mjs ${base} --platform ${platform} --root "$PWD"`)
    expect(workflow).toContain(`PLATFORM: ${platform}`)
})

describe('android-release.yml release branches', () => {
    const file = 'android-release.yml'
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
