/** @jest-environment node */

const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const script = path.join(__dirname, '..', 'check-legacy-android-permissions.mjs')

function makeFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-android-permissions-'))
    const wrapper = path.join(root, 'src/utils/camera-permission.ts')
    fs.mkdirSync(path.dirname(wrapper), { recursive: true })
    fs.writeFileSync(
        wrapper,
        `import { isAndroidNativeBridge } from '@/utils/capacitor'

export async function ensureNativeCameraPermission(): Promise<boolean> {
    if (isAndroidNativeBridge()) return true
    const { Camera } = await import('@capacitor/camera')
    const status = await Camera.checkPermissions()
    if (status.camera === 'granted') return true
    const requested = await Camera.requestPermissions({ permissions: ['camera'] })
    return requested.camera === 'granted'
}
`
    )
    fs.writeFileSync(path.join(root, 'src/safe.ts'), 'export const safe = true\n')
    const git = (...args) =>
        execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' }).trim()
    git('init', '-q')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.invalid')
    git('add', '-A')
    git('commit', '-qm', 'fixture')
    return { root, git }
}

function run(root) {
    return spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' })
}

describe('legacy Android permission guard', () => {
    let fixture

    beforeEach(() => {
        fixture = makeFixture()
    })

    afterEach(() => fs.rmSync(fixture.root, { recursive: true, force: true }))

    it('accepts the guarded iOS-only Camera preflight', () => {
        const result = run(fixture.root)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('guard passed')
    })

    it('rejects a direct Camera import and permission call elsewhere', () => {
        fs.writeFileSync(
            path.join(fixture.root, 'src/unsafe.ts'),
            "import { Camera } from '@capacitor/camera'\nexport const unsafe = () => Camera.checkPermissions()\n"
        )
        fixture.git('add', 'src/unsafe.ts')
        fixture.git('commit', '-qm', 'unsafe')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('src/unsafe.ts')
        expect(result.stderr).toContain('@capacitor/camera is only allowed')
        expect(result.stderr).toContain('direct Capacitor permission calls')
    })

    it('rejects registering the existing Camera plugin through Capacitor core', () => {
        fs.writeFileSync(
            path.join(fixture.root, 'src/unsafe.ts'),
            "import { registerPlugin } from '@capacitor/core'\nexport const Camera = registerPlugin('Camera')\n"
        )
        fixture.git('add', 'src/unsafe.ts')
        fixture.git('commit', '-qm', 'unsafe')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('registerPlugin("Camera")')
    })

    it('rejects moving the Android return below the Camera import', () => {
        const wrapper = path.join(fixture.root, 'src/utils/camera-permission.ts')
        const source = fs.readFileSync(wrapper, 'utf8')
        fs.writeFileSync(
            wrapper,
            source.replace(
                "    if (isAndroidNativeBridge()) return true\n    const { Camera } = await import('@capacitor/camera')",
                "    const { Camera } = await import('@capacitor/camera')\n    if (isAndroidNativeBridge()) return true"
            )
        )
        fixture.git('add', 'src/utils/camera-permission.ts')
        fixture.git('commit', '-qm', 'unsafe wrapper')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('@capacitor/camera is reached before the Android early return')
    })
})
