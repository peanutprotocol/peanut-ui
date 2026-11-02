/** These checks run inside the existing required unit job, without a workflow
 * change or a second runner. Keep both child suites real: no reimplemented
 * assertions, suppressed output, or disabled failures. */
import { execFileSync } from 'node:child_process'

test('numeric lint and capture invariants run in the required unit suite', () => {
    expect(() =>
        execFileSync(
            process.execPath,
            ['--test', 'eslint-rules/finite-numbers.test.cjs', 'scripts/screens/numeric-ui.test.mjs'],
            { cwd: process.cwd(), timeout: 60_000, maxBuffer: 512 * 1024, encoding: 'utf8' }
        )
    ).not.toThrow()
}, 65_000)
