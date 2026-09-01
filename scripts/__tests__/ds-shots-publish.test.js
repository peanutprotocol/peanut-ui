const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SCRIPT_PATH = path.join(__dirname, '..', 'ds-shots-publish.mjs')

// The script is the trust boundary of the workflow_run comment publisher: its
// input is an artifact produced by a job that ran PR code. Its contract is
// stdout + exit code, so drive it the way the workflow does. exit 1 = the
// report was rejected and nothing gets posted.
function run(report, env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-shots-'))
    const file = path.join(dir, 'report.json')
    fs.writeFileSync(file, typeof report === 'string' ? report : JSON.stringify(report))
    return spawnSync(process.execPath, [SCRIPT_PATH, file], { encoding: 'utf-8', env: { ...process.env, ...env } })
}

const SHA_A = 'a'.repeat(40)
const valid = (over = {}) => ({
    changed: [
        { file: 'home@375.png', percent: 3.21, pixels: 1234 },
        { file: 'home@320.png', percent: 1.05, pixels: 400 },
        { file: 'qr-pay@430.png', percent: 100, pixels: 860000, note: '430x900 -> 430x1200' },
    ],
    unchanged: 117,
    added: ['rewards-empty@375.png'],
    removed: [],
    baseline: SHA_A,
    ...over,
})

describe('ds-shots-publish', () => {
    it('renders the sticky comment for a normal report', () => {
        const result = run(valid(), {
            RUN_URL: 'https://github.com/peanutprotocol/peanut-ui/actions/runs/1',
            ARTIFACT_URL: 'https://github.com/peanutprotocol/peanut-ui/actions/runs/1/artifacts/2',
            HEAD_SHA: 'b'.repeat(40),
        })

        expect(result.status).toBe(0)
        expect(result.stdout).toContain('<!-- ds-shots-visual-diff -->')
        expect(result.stdout).toContain('2 screens moved')
        expect(result.stdout).toContain('3 of 120 shots changed')
        expect(result.stdout).toContain('`aaaaaaa` → head `bbbbbbb`')
        // worst screen first, both widths folded into one row
        expect(result.stdout).toContain('| 100.00% | `qr-pay` — resized 430x900 -> 430x1200 | 430 |')
        expect(result.stdout).toContain('| 3.21% | `home` | 320, 375 |')
        expect(result.stdout).toContain('new screens (1)')
        expect(result.stdout).toContain('[job summary](https://github.com/peanutprotocol/peanut-ui/actions/runs/1)')
        expect(result.stdout).toContain('artifacts/2')
    })

    it('still posts (green) when nothing moved', () => {
        const result = run(valid({ changed: [], added: [], removed: [], unchanged: 120 }))

        expect(result.status).toBe(0)
        expect(result.stdout).toContain('<!-- ds-shots-visual-diff -->')
        expect(result.stdout).toContain('no screen moved')
        expect(result.stdout).toContain('120 shots, all identical')
    })

    it.each([
        ['path traversal', { file: '../../../etc/passwd@375.png', percent: 1, pixels: 1 }],
        ['absolute path', { file: '/etc/passwd@375.png', percent: 1, pixels: 1 }],
        ['markdown table breakout', { file: 'a|b@375.png', percent: 1, pixels: 1 }],
        ['html injection', { file: 'a<img src=x onerror=1>@375.png', percent: 1, pixels: 1 }],
        ['backtick breakout', { file: 'a`code`@375.png', percent: 1, pixels: 1 }],
        ['newline smuggling', { file: 'a\n## fake@375.png', percent: 1, pixels: 1 }],
        ['overlong name', { file: `${'a'.repeat(200)}@375.png`, percent: 1, pixels: 1 }],
        ['non-string file', { file: 42, percent: 1, pixels: 1 }],
        ['NaN percent', { file: 'home@375.png', percent: NaN, pixels: 1 }],
        ['percent out of range', { file: 'home@375.png', percent: 101, pixels: 1 }],
        ['string percent', { file: 'home@375.png', percent: '3.2', pixels: 1 }],
        ['injected note', { file: 'home@375.png', percent: 1, pixels: 1, note: '](x) <script>' }],
    ])('rejects a report with a malicious changed entry: %s', (_label, entry) => {
        const result = run(valid({ changed: [entry] }))

        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain('report rejected')
    })

    it.each([
        [
            'oversized changed list',
            valid({ changed: Array(1001).fill({ file: 'home@375.png', percent: 1, pixels: 1 }) }),
        ],
        ['injected added name', valid({ added: ['[click](https://evil.example)@375.png'] })],
        ['missing baseline', valid({ baseline: undefined })],
        ['short baseline', valid({ baseline: 'abc123' })],
        ['injected baseline', valid({ baseline: '`](x)'.padEnd(40, 'a') })],
        ['negative unchanged', valid({ unchanged: -1 })],
        ['array report', [1, 2, 3]],
        ['not json at all', 'not json {'],
    ])('rejects: %s', (_label, report) => {
        const result = run(report)

        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
    })

    it('caps the table and stays under the github comment size limit', () => {
        // 500 screens x 2 widths — a report engineered to bloat the comment
        const changed = []
        for (let i = 0; i < 500; i++) {
            changed.push({ file: `screen-${i}@375.png`, percent: 50, pixels: 1 })
            changed.push({ file: `screen-${i}@430.png`, percent: 40, pixels: 1 })
        }
        const added = Array.from({ length: 200 }, (_, i) => `new-screen-${i}@375.png`)
        const result = run(valid({ changed, added }))

        expect(result.status).toBe(0)
        expect(result.stdout).toContain('…and 480 more')
        expect(result.stdout).toContain('…and 170 more')
        expect(Buffer.byteLength(result.stdout)).toBeLessThan(65000)
        // 20 table rows, not 500
        expect(result.stdout.split('\n').filter((l) => l.startsWith('| 5')).length).toBe(20)
    })
})
