/** @jest-environment node */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release-native.yml'), 'utf8')
const step = workflow.slice(workflow.indexOf('- name: Decide whether a native build is required'))
const shell = step
    .match(/run: \|\n([\s\S]*?)\n\s+# `native`/)[1]
    .split('\n')
    .map((line) => line.replace(/^ {18}/, ''))
    .join('\n')

function decide(overrides = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-main-trigger-'))
    const output = path.join(directory, 'output')
    try {
        const result = spawnSync(
            'bash',
            [
                '-euo',
                'pipefail',
                '-c',
                `
                git() { printf '%s\\trefs/heads/main\\n' "$REMOTE_SHA"; }
                node() {
                    if [ "$1" = scripts/release-version.mjs ]; then
                        printf '%s' "$FLOOR"
                    else
                        if [ "$DIFF_FAILURE" = true ]; then return 1; fi
                        printf '%s' "$CHANGED"
                    fi
                }
                ${shell}
                `,
            ],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    RELEASE_EVENT: 'push',
                    GITHUB_SHA: 'a'.repeat(40),
                    REMOTE_SHA: 'a'.repeat(40),
                    GITHUB_OUTPUT: output,
                    FLOOR: '1.6.0',
                    CHANGED: 'true',
                    DIFF_FAILURE: 'false',
                    ...overrides,
                },
            }
        )
        return { status: result.status, output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8').trim() : '' }
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
}

describe('native release after a reviewed main merge', () => {
    it('builds a changed native surface and skips a web-only push', () => {
        expect(decide()).toEqual({ status: 0, output: 'required=true' })
        expect(decide({ CHANGED: 'false' })).toEqual({ status: 0, output: 'required=false' })
    })

    it('allows an intentional manual rebuild and the first native release', () => {
        expect(decide({ RELEASE_EVENT: 'workflow_dispatch', CHANGED: 'false' })).toEqual({
            status: 0,
            output: 'required=true',
        })
        expect(decide({ FLOOR: '' })).toEqual({ status: 0, output: 'required=true' })
    })

    it('does not authorize a build on a stale main commit or fingerprint failure', () => {
        expect(decide({ REMOTE_SHA: 'b'.repeat(40) })).toEqual({ status: 1, output: '' })
        expect(decide({ DIFF_FAILURE: 'true' })).toEqual({ status: 1, output: '' })
    })

    it('gates both store builds and defaults automatic Android uploads to internal', () => {
        expect(workflow).toMatch(/push:\n\s+branches: \[main\]/)
        expect(workflow.match(/if: needs.resolve.outputs.build_required == 'true'/g)).toHaveLength(2)
        expect(workflow).toContain("track: ${{ inputs.track || 'internal' }}")
        expect(workflow).toContain('needs: [resolve, ios, android]')
        expect(workflow).toContain('group: production-release')
    })
})
