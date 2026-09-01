const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { PNG } = require('pngjs')

const SCRIPT_PATH = path.join(__dirname, '..', 'visual-diff.mjs')

// PR captures shoot 2 of the baseline's 4 widths (tests.yml), so the diff
// must not report the widths a partial capture never shot as "removed" —
// while a screen that is really gone must still be reported. The script is a
// CI entrypoint, so drive it the way the workflow does: two directories in,
// JSON out.
function png(color) {
    const img = new PNG({ width: 2, height: 2 })
    for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = color
        img.data[i + 3] = 255
    }
    return PNG.sync.write(img)
}

function capture(dir, shots) {
    fs.mkdirSync(dir, { recursive: true })
    for (const [file, color] of Object.entries(shots)) fs.writeFileSync(path.join(dir, file), png(color))
}

function diff(before, after) {
    const out = path.join(path.dirname(before), 'diff')
    const result = spawnSync(process.execPath, [SCRIPT_PATH, before, after, `--out=${out}`, '--json'], {
        encoding: 'utf-8',
    })
    expect(result.status).toBe(0)
    return JSON.parse(result.stdout)
}

describe('visual-diff partial-width capture', () => {
    let root
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-diff-'))
    })

    it('does not report baseline-only widths as removed', () => {
        capture(path.join(root, 'base'), {
            'home@320.png': 0,
            'home@375.png': 0,
            'home@430.png': 0,
        })
        capture(path.join(root, 'head'), {
            'home@320.png': 0,
            'home@430.png': 0,
        })

        const report = diff(path.join(root, 'base'), path.join(root, 'head'))

        expect(report.removed).toEqual([])
        expect(report.added).toEqual([])
        expect(report.changed).toEqual([])
        expect(report.unchanged).toBe(2)
    })

    it('still reports a screen that is really gone', () => {
        capture(path.join(root, 'base'), {
            'home@320.png': 0,
            'home@375.png': 0,
            'gone@320.png': 0,
            'gone@375.png': 0,
        })
        capture(path.join(root, 'head'), {
            'home@320.png': 0,
        })

        const report = diff(path.join(root, 'base'), path.join(root, 'head'))

        // 375 was never shot, so only the captured width proves the removal
        expect(report.removed).toEqual(['gone@320.png'])
    })

    it('fails loud when the capture produced nothing', () => {
        capture(path.join(root, 'base'), { 'home@320.png': 0 })
        capture(path.join(root, 'head'), {})

        const out = path.join(root, 'diff')
        const result = spawnSync(
            process.execPath,
            [SCRIPT_PATH, path.join(root, 'base'), path.join(root, 'head'), `--out=${out}`, '--json'],
            { encoding: 'utf-8' }
        )

        // an empty after dir must never diff all-green — that is tool breakage
        expect(result.status).toBe(2)
        expect(result.stderr).toContain('capture produced nothing')
    })

    it('still detects pixel changes and additions at captured widths', () => {
        capture(path.join(root, 'base'), {
            'home@320.png': 0,
            'home@375.png': 0,
        })
        capture(path.join(root, 'head'), {
            'home@320.png': 255,
            'new-screen@320.png': 0,
        })

        const report = diff(path.join(root, 'base'), path.join(root, 'head'))

        expect(report.changed.map((c) => c.file)).toEqual(['home@320.png'])
        expect(report.changed[0].percent).toBe(100)
        expect(report.added).toEqual(['new-screen@320.png'])
        expect(report.removed).toEqual([])
    })
})
