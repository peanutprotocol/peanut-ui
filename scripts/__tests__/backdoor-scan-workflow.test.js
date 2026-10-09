/** @jest-environment node */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const root = path.join(__dirname, '../..')
const scanner = fs.readFileSync(path.join(root, 'scripts/backdoor-scan.mjs'), 'utf8')
const scanWorkflow = fs.readFileSync(path.join(root, '.github/workflows/backdoor-scan.yml'), 'utf8')
// Execute the real workflow's shell, including scanner extraction/provenance.
const scanStep = scanWorkflow.split('              run: |\n')[1].replace(/^ {18}/gm, '')
const payload = `module.exports = {};${' '.repeat(80)}void 0`

function fixture({ attack = true, scannerOnBase = true, tamper = false, diverged = false } = {}) {
    // Node resolves module URLs through macOS /var -> /private/var symlinks.
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'backdoor-workflow-')))
    const git = (...args) =>
        execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git('init', '--initial-branch=base')
    git('config', 'user.email', 'test@example.invalid')
    git('config', 'user.name', 'Workflow test')
    fs.mkdirSync(path.join(dir, 'scripts'))
    if (scannerOnBase) fs.writeFileSync(path.join(dir, 'scripts/backdoor-scan.mjs'), scanner)
    fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n')
    fs.writeFileSync(path.join(dir, 'tailwind.config.js'), 'module.exports = {}\n')
    git('add', '.')
    git('commit', '-m', 'trusted base')
    let base = git('rev-parse', 'HEAD')
    git('checkout', '-b', 'pr')
    fs.writeFileSync(path.join(dir, 'tailwind.config.js'), attack ? `${payload}\n` : 'module.exports = { theme: {} }\n')
    if (tamper) fs.writeFileSync(path.join(dir, 'scripts/backdoor-scan.mjs'), 'process.exit(0)\n')
    if (tamper) {
        fs.mkdirSync(path.join(dir, '.github'))
        fs.writeFileSync(
            path.join(dir, '.github/backdoor-scan-allow.txt'),
            `${createHash('sha256').update(payload.trim()).digest('hex')}\n`
        )
    }
    git('add', '.')
    git('commit', '-m', 'first PR change')
    fs.writeFileSync(path.join(dir, 'README.md'), 'innocuous final PR commit\n')
    if (!scannerOnBase && !tamper) fs.writeFileSync(path.join(dir, 'scripts/backdoor-scan.mjs'), scanner)
    git('add', '.')
    git('commit', '-m', 'innocuous final PR commit')
    const head = git('rev-parse', 'HEAD')
    if (diverged) {
        git('checkout', 'base')
        fs.writeFileSync(path.join(dir, 'base-only.md'), 'base advanced independently\n')
        git('add', '.')
        git('commit', '-m', 'base branch advanced')
        base = git('rev-parse', 'HEAD')
        git('checkout', '--detach', head)
    }
    fs.mkdirSync(path.join(dir, 'runner-temp'))
    const run = (range = {}) =>
        spawnSync('bash', ['-e', '-o', 'pipefail', '-c', scanStep], {
            cwd: dir,
            encoding: 'utf8',
            env: {
                ...process.env,
                TYPESAFE_API_KEY: '',
                RUNNER_TEMP: path.join(dir, 'runner-temp'),
                BASE_SHA: '',
                HEAD_SHA: '',
                ...range,
            },
        })
    return { dir, base, head, run, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

let repo
beforeEach(() => {
    repo = undefined
})
afterEach(() => repo?.cleanup())

describe('backdoor scan workflow range', () => {
    it('wires the validated PR range into the scan before capture', () => {
        const manual = fs.readFileSync(path.join(root, '.github/workflows/ds-shots.yml'), 'utf8')
        const job = manual.split('    backdoor-scan:\n')[1].split('    capture:\n')[0]
        expect(job).toContain('base_sha: ${{ needs.prepare.outputs.base }}')
        expect(job).toContain('head_sha: ${{ needs.prepare.outputs.head }}')
        expect(manual).toContain('needs: [prepare, backdoor-scan]')
    })

    it('fetches full ancestry for explicit ranges and keeps the existing default depth', () => {
        const expression = scanWorkflow.match(/fetch-depth: \$\{\{ (.*?) \}\}/)[1]
        const depth = new Function('inputs', `return ${expression}`)
        expect(depth({ base_sha: 'a'.repeat(40) })).toBe('0')
        expect(depth({ base_sha: '' })).toBe('2')
    })

    it('finds the earlier payload when the base branch has diverged from the PR', () => {
        repo = fixture({ diverged: true })
        const result = repo.run({ BASE_SHA: repo.base, HEAD_SHA: repo.head })
        expect(result.stdout + result.stderr).toContain('hidden-code')
        expect(result.status).toBe(1)
    })

    it('blocks a payload in an earlier PR commit even when the final commit is innocuous', () => {
        repo = fixture()
        const result = repo.run({ BASE_SHA: repo.base, HEAD_SHA: repo.head })
        expect(result.stdout + result.stderr).toContain('hidden-code')
        expect(result.status).toBe(1)
    })

    it('preserves the default previous-commit scan for existing callers', () => {
        repo = fixture()
        const result = repo.run()
        expect(result.stdout).toContain('backdoor-scan: clean')
        expect(result.status).toBe(0)
    })

    it('preserves bootstrap behavior for an existing caller whose base predates the scanner', () => {
        repo = fixture({ attack: false, scannerOnBase: false })
        const result = repo.run()
        expect(result.stdout).toContain('backdoor-scan: clean')
        expect(result.status).toBe(0)
    })

    it('accepts a legitimate multi-commit PR', () => {
        repo = fixture({ attack: false })
        const result = repo.run({ BASE_SHA: repo.base, HEAD_SHA: repo.head })
        expect(result.stdout).toContain('backdoor-scan: clean')
        expect(result.status).toBe(0)
    })

    it('uses the trusted base scanner and allowlist even if an earlier PR commit changes both', () => {
        repo = fixture({ tamper: true })
        const result = repo.run({ BASE_SHA: repo.base, HEAD_SHA: repo.head })
        expect(result.stdout + result.stderr).toContain('hidden-code')
        expect(result.status).toBe(1)
    })

    it('fails closed if the trusted base has no scanner instead of running the PR copy', () => {
        repo = fixture({ scannerOnBase: false })
        const result = repo.run({ BASE_SHA: repo.base, HEAD_SHA: repo.head })
        expect(result.status).not.toBe(0)
        expect(result.stdout).not.toContain('backdoor-scan: clean')
    })

    it.each(['missing-base', 'missing-head', 'invalid-base', 'invalid-head', 'wrong-head'])(
        'rejects an incomplete or mismatched explicit range: %s',
        (variant) => {
            repo = fixture({ attack: false })
            const range = { BASE_SHA: repo.base, HEAD_SHA: repo.head }
            if (variant === 'missing-base') range.BASE_SHA = ''
            if (variant === 'missing-head') range.HEAD_SHA = ''
            if (variant === 'invalid-base') range.BASE_SHA = 'HEAD^1'
            if (variant === 'invalid-head') range.HEAD_SHA = '--help'
            if (variant === 'wrong-head') range.HEAD_SHA = repo.base
            const result = repo.run(range)
            expect(result.status).not.toBe(0)
            expect(result.stdout).not.toContain('backdoor-scan: clean')
        }
    )
})
