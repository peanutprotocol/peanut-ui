/** @jest-environment node */

const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const repoRoot = path.join(__dirname, '..', '..')
const script = path.join(__dirname, '..', 'check-native-ota-surface.mjs')
const fingerprintScript = path.join(__dirname, '..', 'native-fingerprint.mjs')
const fixtureFiles = [
    'package.json',
    'pnpm-lock.yaml',
    'capacitor.config.ts',
    'scripts/native-ios-postsync.js',
    'android/capacitor.settings.gradle',
    'android/build.gradle',
    'android/variables.gradle',
    'android/app/build.gradle',
    'android/app/proguard-rules.pro',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/java/me/peanut/wallet/MainActivity.java',
    'ios/App/CapApp-SPM/Package.swift',
    'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved',
    'ios/App/App.xcodeproj/project.pbxproj',
    'src/utils/camera-permission.ts',
]

function makeFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-ota-surface-'))
    for (const relative of fixtureFiles) {
        const source = path.join(repoRoot, relative)
        if (!fs.existsSync(source)) continue
        const target = path.join(root, relative)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.copyFileSync(source, target)
    }
    const git = (...args) =>
        execFileSync('git', ['-c', 'tag.gpgSign=false', '-c', 'commit.gpgsign=false', ...args], {
            cwd: root,
            encoding: 'utf8',
        }).trim()
    git('init', '-q')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.invalid')
    git('add', '-A')
    git('commit', '-qm', 'base')
    git('tag', '-a', 'v1.5.0', '-m', 'native base')
    return { root, git }
}

function run(root, ...args) {
    return spawnSync(process.execPath, [script, 'v1.5.0', '--root', root, ...args], { encoding: 'utf8' })
}

function fingerprint(root, ref = 'HEAD', schema = 'v3') {
    return execFileSync(process.execPath, [fingerprintScript, '--root', root, '--ref', ref, '--schema', schema], {
        encoding: 'utf8',
    }).trim()
}

function recordReplacement(
    fixture,
    {
        tag = 'android-v1.5.0-replacement-fix',
        platform = 'android',
        baseRef = 'v1.5.0',
        schema = 'v3',
        value = fingerprint(fixture.root, 'HEAD', schema),
    } = {}
) {
    fixture.git(
        'tag',
        '-a',
        tag,
        '-m',
        'Android replacement',
        '-m',
        `peanut-native-replacement-${schema}: platform=${platform} base=${baseRef} native-compatible=true js-guard=android-capacitor-permissions-v1 fingerprint=${value}`
    )
    return tag
}

describe('native OTA replacement baseline', () => {
    let fixture

    beforeEach(() => {
        fixture = makeFixture()
    })

    afterEach(() => fs.rmSync(fixture.root, { recursive: true, force: true }))

    it('uses the original native tag when no replacement exists', () => {
        const result = run(fixture.root)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('matches original v1.5.0')
    })

    it('accepts an attested ProGuard-only replacement and later permission-safe JS commits', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# retain runtime metadata\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair R8')
        const tag = recordReplacement(fixture)
        const laterJs = path.join(fixture.root, 'src/later.ts')
        fs.writeFileSync(laterJs, 'export const later = true\n')
        fixture.git('add', 'src/later.ts')
        fixture.git('commit', '-qm', 'later JS')

        const result = run(fixture.root)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain(`matches attested android replacement ${tag}`)
        expect(result.stdout).toContain('older v1.5.0 installs remain')
    })

    it('keeps pre-split v2 replacement attestations verifiable', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# retain runtime metadata\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair R8 before schema split')
        const tag = recordReplacement(fixture, { schema: 'v2' })

        const result = run(fixture.root)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain(`matches attested android replacement ${tag}`)
        expect(fingerprint(fixture.root, tag, 'v2')).not.toBe(fingerprint(fixture.root, tag, 'v3'))
    })

    it('rejects later JavaScript that calls Camera directly on legacy Android shells', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# retain runtime metadata\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair R8')
        recordReplacement(fixture)
        const laterJs = path.join(fixture.root, 'src/later.ts')
        fs.writeFileSync(
            laterJs,
            "import { Camera } from '@capacitor/camera'\nexport const later = () => Camera.checkPermissions()\n"
        )
        fixture.git('add', 'src/later.ts')
        fixture.git('commit', '-qm', 'unsafe later OTA')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('legacy Android permission guard failed')
        expect(result.stderr).toContain('src/later.ts')
    })

    it('rejects native drift after the recorded replacement', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# first fix\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'first repair')
        recordReplacement(fixture)
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# unshipped drift\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'drift')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('differs from android-v1.5.0-replacement-fix')
    })

    it('rejects a replacement that changes a JS/native contract', () => {
        fs.appendFileSync(
            path.join(fixture.root, 'android/app/src/main/java/me/peanut/wallet/MainActivity.java'),
            '\n// new bridge contract\n'
        )
        fixture.git('add', 'android/app/src/main/java/me/peanut/wallet/MainActivity.java')
        fixture.git('commit', '-qm', 'unsafe replacement')
        recordReplacement(fixture)

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('older same-version android installs do not have')
        expect(result.stderr).toContain('android/app/src/**.{java,kt}')
    })

    it('rejects an attestation whose fingerprint does not match the tagged commit', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# fix\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair')
        recordReplacement(fixture, { value: '0000000000000000' })

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('attests fingerprint 0000000000000000')
        expect(result.stderr).toContain('but its commit is')
    })

    it('rejects an attestation for another platform or base', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# fix\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair')
        recordReplacement(fixture, { platform: 'ios', baseRef: 'v1.4.0' })

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('attests ios from v1.4.0, expected android from v1.5.0')
    })

    it('rejects a replacement tag that records no native change', () => {
        recordReplacement(fixture)

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('records no native replacement change')
    })

    it('rejects lightweight replacement tags', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# fix\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair')
        fixture.git('tag', 'android-v1.5.0-replacement-lightweight')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('must be annotated attestations')
    })

    it('rejects malformed annotated replacement tags', () => {
        fs.appendFileSync(path.join(fixture.root, 'android/app/proguard-rules.pro'), '\n# fix\n')
        fixture.git('add', 'android/app/proguard-rules.pro')
        fixture.git('commit', '-qm', 'repair')
        fixture.git('tag', '-a', 'android-v1.5.0-replacement-malformed', '-m', 'missing attestation')

        const result = run(fixture.root)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('missing a valid peanut-native-replacement-v2 or v3 attestation')
    })
})
