/** @jest-environment node */

const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const workflow = readFileSync(join(__dirname, '../../.github/workflows/tests.yml'), 'utf8')
const contractJob = workflow.match(/^    press-contract:\n[\s\S]*?(?=^    [a-z][\w-]*:)/m)[0]
const successJob = workflow.slice(workflow.indexOf('    ci-success:'))

test('the required browser job runs press and focus contracts without advisory failure handling', () => {
    expect(contractJob).toContain('e2e/flows/button-press-physics.spec.ts')
    expect(contractJob).toContain('e2e/flows/input-focus-contract.spec.ts')
    expect(contractJob).toContain('--fail-on-flaky-tests')
    expect(contractJob).not.toContain('continue-on-error: true')
    expect(successJob.slice(0, successJob.indexOf('runs-on:'))).toContain('press-contract')
})

test.each(['success', 'failure', 'cancelled', 'skipped'])(
    'ci-success rejects a %s contract unless successful',
    (result) => {
        // execute the real gate shell with other jobs successful.
        const shell = successJob
            .slice(successJob.indexOf('run: |') + 'run: |'.length)
            .replace(/\$\{\{(.*?)\}\}/g, (_, expression) => {
                if (expression.trim() === "needs['press-contract'].result") return result
                if (expression.includes('contains(')) return String(['failure', 'cancelled'].includes(result))
                if (/^needs[.\[]/.test(expression.trim())) return 'success'
                throw new Error(`unhandled workflow expression: ${expression}`)
            })
        const run = spawnSync('bash', ['-eu', '-c', shell], { encoding: 'utf8' })
        expect(run.status).toBe(result === 'success' ? 0 : 1)
    }
)
