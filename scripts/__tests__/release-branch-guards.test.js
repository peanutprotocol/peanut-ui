/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows')

// Execute only the branch guard, never the version resolver or deployment steps.
function guardOf(file) {
    const workflow = fs.readFileSync(path.join(workflowsDir, file), 'utf8')
    return workflow.match(/if \[ "\$GITHUB_REF_NAME"[^\n]+; then\n[\s\S]*?\n\s+fi/)[0]
}

function run(guard, branch) {
    return spawnSync('bash', ['-eu', '-c', guard], {
        env: { ...process.env, GITHUB_REF_NAME: branch },
        encoding: 'utf8',
    })
}

/*
 * A production OTA reaches every shipped install, and there is exactly one ref
 * it may come from. `dev` and `main` both looked shippable at dispatch time and
 * the older one was picked — bundle 1.6.1 went out from a `main` two days behind
 * the v1.6.0 release. Merging to `main` is now the decision to ship; `dev` goes
 * to staging, which no production device sees.
 */
describe('release-ota.yml ships from main only', () => {
    const guard = guardOf('release-ota.yml')

    it('accepts main', () => {
        expect(run(guard, 'main').status).toBe(0)
    })

    it.each(['dev', 'release/android-kyc', 'feature/kyc', 'release/other', 'main-fix', ''])('refuses %s', (branch) => {
        const result = run(guard, branch)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })

    it('only auto-runs on pushes to main', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        expect(workflow).toMatch(/push:\n\s+branches: \[main\]/)
        expect(workflow).not.toContain('workflow_dispatch')
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
        expect(workflow.match(/git ls-remote origin refs\/heads\/main/g)).toHaveLength(2)
        expect(workflow).toContain('EXPECTED_MAIN_SHA: ${{ github.sha }}')
        expect(workflow).toContain('guard_current_main\n                    # Bundle selection and rollout disablement')
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
