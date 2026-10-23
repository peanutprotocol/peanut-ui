/** @jest-environment node */

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const SCRIPT_PATH = path.join(__dirname, '..', 'store-build-event.mjs')
const RELEASE_ENV = {
    PLATFORM: 'ios',
    VERSION: '1.20.0',
    BUILD: '25264295',
    COMMIT: 'f42ef7329a5b',
    TRACK: 'testflight',
    RUN_URL: 'https://github.com/peanutprotocol/peanut-ui/actions/runs/1',
}

// A CI entrypoint: its contract is stdout + exit code, so run it the way the release workflows do.
function run(env, ...args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
        encoding: 'utf-8',
        env: { PATH: process.env.PATH, ...env },
    })
}

function dryRunEvent(env) {
    const result = run(env, '--dry-run')
    expect(result.status).toBe(0)
    return JSON.parse(result.stdout)
}

describe('store-build-event', () => {
    it('records the upload without a person profile', () => {
        const event = dryRunEvent(RELEASE_ENV)
        expect(event.event).toBe('store_build_submitted')
        expect(event.distinct_id).toBe('peanut-ui-release')
        expect(event.properties).toMatchObject({
            $process_person_profile: false,
            platform: 'ios',
            version: '1.20.0',
            build: '25264295',
            commit: 'f42ef7329a5b',
            track: 'testflight',
            workflow_run_url: RELEASE_ENV.RUN_URL,
        })
    })

    it('gives a retried upload of the same build the same uuid, and another build a new one', () => {
        const first = dryRunEvent(RELEASE_ENV)
        expect(dryRunEvent(RELEASE_ENV).uuid).toBe(first.uuid)
        expect(dryRunEvent({ ...RELEASE_ENV, BUILD: '25264296' }).uuid).not.toBe(first.uuid)
        expect(dryRunEvent({ ...RELEASE_ENV, PLATFORM: 'android' }).uuid).not.toBe(first.uuid)
    })

    it('refuses an unknown platform or a missing build', () => {
        expect(run({ ...RELEASE_ENV, PLATFORM: 'web' }, '--dry-run').status).toBe(1)
        expect(run({ ...RELEASE_ENV, BUILD: '' }, '--dry-run').status).toBe(1)
    })

    it('runs after each store upload and never fails the release', () => {
        for (const file of ['ios-release.yml', 'android-release.yml']) {
            const workflow = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', file), 'utf8')
            const step = workflow.slice(workflow.indexOf('            - name: Record the store upload in PostHog'))
            expect(step).toContain('continue-on-error: true')
            expect(step).toContain('run: node scripts/store-build-event.mjs')
            const upload = file.startsWith('ios')
                ? '- name: Retry upload to TestFlight'
                : '- name: Retry upload to Google Play'
            expect(workflow.indexOf(upload)).toBeLessThan(
                workflow.indexOf('- name: Record the store upload in PostHog')
            )
        }
    })
})
