const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SCRIPT_PATH = path.join(__dirname, '..', 'native-fingerprint.mjs')
const repoRoot = path.join(__dirname, '..', '..')

// The real files the manifest reads, copied once into the fixture. Anything
// absent is skipped, so this list can lag the manifest without breaking.
const FIXTURE_FILES = [
    'package.json',
    'pnpm-lock.yaml',
    'capacitor.config.ts',
    'scripts/native-ios-postsync.js',
    'android/capacitor.settings.gradle',
    'android/build.gradle',
    'android/variables.gradle',
    'android/app/build.gradle',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/res/values/capacitor-passkey.xml',
    'android/app/src/main/java/me/peanut/wallet/MainActivity.java',
    'android/app/src/meawallet/java/me/peanut/wallet/PushProvisioningPlugin.java',
    'ios/App/CapApp-SPM/Package.swift',
    'ios/App/App.xcodeproj/project.pbxproj',
    'ios/App/App/Info.plist',
    'ios/App/App/App.entitlements',
    'ios/App/App/AppRelease.entitlements',
    'ios/App/App/ClipboardDetectPlugin.swift',
    'ios/App/PushProvisioningExtension/PushProvisioningExtension.entitlements',
    'patches/@zerodev__webauthn-key.patch',
]

/*
 * Every mutation happens in a throwaway git repo, never in this checkout.
 *
 * The first version of this suite rewrote tracked files around a spawned CLI
 * and restored them in a `finally`. That is not isolation: Jest runs suites in
 * parallel, and marketing-version.test.js reads the same project.pbxproj — so
 * holding it at MARKETING_VERSION 9.9.9 for the length of a subprocess made an
 * unrelated suite fail on timing. `--root` exists so the CLI can be pointed at
 * a fixture instead.
 */
function makeFixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-fp-'))
    const git = (...args) => {
        const result = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' })
        if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
        return result.stdout
    }

    for (const relative of FIXTURE_FILES) {
        const source = path.join(repoRoot, relative)
        if (!fs.existsSync(source)) continue
        fs.mkdirSync(path.join(dir, path.dirname(relative)), { recursive: true })
        fs.copyFileSync(source, path.join(dir, relative))
    }

    git('init', '-q')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    git('config', 'commit.gpgsign', 'false')
    git('add', '-A')
    git('commit', '-qm', 'fixture')
    return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

// The script is a CI entrypoint: its contract is stdout + exit code, so run it
// the way capgo-deploy.yml does instead of reaching into its internals. (Jest
// runs CJS here, so a dynamic import of the .mjs would not load anyway — same
// reason semver-newer.test.js and release-version.test.js spawn it.)
function run(root, ...args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, '--root', root, ...args], { encoding: 'utf-8' })
}

describe('native-fingerprint', () => {
    let fixture

    beforeAll(() => {
        fixture = makeFixture()
    })

    afterAll(() => fixture.cleanup())

    const fingerprint = (...args) => {
        const result = run(fixture.dir, ...args)
        expect(result.status).toBe(0)
        return result.stdout.trim()
    }

    // Mutate a file in the FIXTURE, assert, restore. Nothing here touches the
    // checkout other suites are reading.
    function withPatchedInput(relativePath, patch, assertion) {
        const target = path.join(fixture.dir, relativePath)
        const original = fs.readFileSync(target, 'utf8')
        try {
            fs.writeFileSync(target, patch(original))
            assertion()
        } finally {
            fs.writeFileSync(target, original)
        }
    }

    it('is a stable 16-hex digest across repeated runs of one tree', () => {
        const first = fingerprint()

        expect(first).toMatch(/^[0-9a-f]{16}$/)
        expect(fingerprint()).toBe(first)
    })

    it('covers every native input, hashing it or recording its absence', () => {
        const result = run(fixture.dir, '--manifest')
        const keys = Object.keys(JSON.parse(result.stdout))

        expect(result.status).toBe(0)
        // toContain on the key list, not toHaveProperty: these keys contain
        // dots, which toHaveProperty would read as a nested property path.
        expect(keys).toContain('android/capacitor.settings.gradle')
        expect(keys).toContain('ios/App/CapApp-SPM/Package.swift')
        expect(keys).toContain('capacitor.config.ts')
        expect(keys).toContain('android/app/src/**.{java,kt}')
        expect(keys).toContain('ios/App/**.swift')
        expect(keys).toContain('native-plugin-versions')
        expect(keys).toContain('android/app/src/main/res/**.xml')
        expect(keys).toContain('ios/App/**.{plist,entitlements}')
        expect(keys).toContain('patches/**')
    })

    it('matches its own committed tree, which proves the ref path reads content', () => {
        // An unresolvable read would make every input <absent> — a well-formed
        // fingerprint of nothing. Equality with HEAD is what rules that out.
        expect(fingerprint('--ref', 'HEAD')).toBe(fingerprint())
    })

    it('exits 0 and says so when the surface has not moved', () => {
        const result = run(fixture.dir, '--diff', 'HEAD')

        expect(result.status).toBe(0)
        expect(result.stdout).toContain('native surface unchanged')
    })

    it('exits 1 naming the culprit when the surface moved', () => {
        withPatchedInput(
            'android/capacitor.settings.gradle',
            (content) => content.replace('capacitor-updater@8.51.14', 'capacitor-updater@9.0.0'),
            () => {
                const result = run(fixture.dir, '--diff', 'HEAD')

                expect(result.status).toBe(1)
                expect(result.stdout).toContain('native surface changed since HEAD')
                // It must say WHAT moved — a bare "refused" is unactionable.
                expect(result.stdout).toContain('android/capacitor.settings.gradle')
            }
        )
    })

    it('moves when a plugin version changes', () => {
        const before = fingerprint()

        withPatchedInput(
            'android/capacitor.settings.gradle',
            (content) => content.replace('capacitor-updater@8.51.14', 'capacitor-updater@9.0.0'),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('ignores the MARKETING_VERSION stamp, which is the release number not the surface', () => {
        const before = fingerprint()

        withPatchedInput(
            'ios/App/App.xcodeproj/project.pbxproj',
            // What native-ios-postsync.js writes on every cap sync. Left raw
            // this would refuse an OTA after every release.
            (content) => content.replace(/MARKETING_VERSION = [^;]*;/g, 'MARKETING_VERSION = 9.9.9;'),
            () => expect(fingerprint()).toBe(before)
        )
    })

    it('still notices a real pbxproj change, e.g. the deployment floor', () => {
        const before = fingerprint()

        withPatchedInput(
            'ios/App/App.xcodeproj/project.pbxproj',
            (content) => content.replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]*;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 18.0;'),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves when the postsync script bumps a pinned native SDK', () => {
        const before = fingerprint()

        withPatchedInput(
            // MPP_VERSION and SUMSUB_VERSION are string constants in here, and
            // the release workflow runs it after cap sync to vendor those
            // frameworks. Nothing else in the manifest records them.
            'scripts/native-ios-postsync.js',
            (content) => content.replace("const MPP_VERSION = '2.0.0'", "const MPP_VERSION = '2.1.0'"),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves when a compiled Android bridge changes', () => {
        const before = fingerprint()

        withPatchedInput(
            // Where the app-local plugins are registered. No config file moves
            // when it changes.
            'android/app/src/main/java/me/peanut/wallet/MainActivity.java',
            (content) => `${content}\n// surface change\n`,
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('tracks the credential-gated source set too, erring toward refusal', () => {
        const before = fingerprint()

        withPatchedInput(
            // build.gradle adds src/meawallet only when the Nexus credentials
            // are present, so whether it reaches the binary is not knowable
            // from the tree. Both choices are unsound; including it can only
            // force an unnecessary native release, while excluding it fails
            // silently when the binary DOES carry the bridge.
            'android/app/src/meawallet/java/me/peanut/wallet/PushProvisioningPlugin.java',
            (content) => `${content}\n// surface change\n`,
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('lists every plugin Capacitor generated in NATIVE_DEPENDENCIES', () => {
        // Keeps the explicit map honest: a plugin that has been synced cannot
        // silently drop out of it, which is what makes the map trustworthy for
        // the case it exists to cover — a generically-named plugin whose
        // manifests are stale, invisible to both the name heuristic and to
        // Capacitor's own list.
        // Parsed from the source, not imported: Jest runs CJS here, so a
        // dynamic import of the .mjs does not resolve.
        const source = fs.readFileSync(SCRIPT_PATH, 'utf8')
        const listed = source.slice(
            source.indexOf('export const NATIVE_DEPENDENCIES = ['),
            source.indexOf(']', source.indexOf('export const NATIVE_DEPENDENCIES = ['))
        )
        const NATIVE_DEPENDENCIES = [...listed.matchAll(/'([^']+)'/g)].map((m) => m[1])
        const gradle = fs.readFileSync(path.join(repoRoot, 'android/capacitor.settings.gradle'), 'utf8')
        const swift = fs.readFileSync(path.join(repoRoot, 'ios/App/CapApp-SPM/Package.swift'), 'utf8')

        const generated = new Set()
        for (const match of `${gradle}${swift}`.matchAll(/node_modules\/((?:@[^/]+\/)?[^/'"]+)(?:\/android|")/g)) {
            if (match[1] !== '@capacitor') generated.add(match[1])
        }

        expect([...generated].filter((name) => !NATIVE_DEPENDENCIES.includes(name))).toEqual([])
    })

    it('moves when an iOS bridge changes', () => {
        const before = fingerprint()

        withPatchedInput(
            'ios/App/App/ClipboardDetectPlugin.swift',
            (content) => `${content}\n// surface change\n`,
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves on a lockfile-only plugin bump, which the generated manifests miss', () => {
        const before = fingerprint()

        withPatchedInput(
            'pnpm-lock.yaml',
            // The OTA workflow runs `pnpm install` but never regenerates the
            // committed Capacitor manifests, so a bump without a `cap sync`
            // ships the new JS wrapper against unchanged manifest bytes.
            (content) => content.split('@capgo/capacitor-updater@8.51.14').join('@capgo/capacitor-updater@9.0.0'),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves when the passkey asset statement changes', () => {
        const before = fingerprint()

        withPatchedInput(
            // AndroidManifest.xml delegates to it and does not move with it.
            'android/app/src/main/res/values/capacitor-passkey.xml',
            (content) => `${content}\n<!-- surface change -->\n`,
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves when an extension entitlement changes', () => {
        const before = fingerprint()

        withPatchedInput(
            'ios/App/PushProvisioningExtension/PushProvisioningExtension.entitlements',
            (content) => `${content}\n`,
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves on a pnpm patch, which changes both halves with no version bump', () => {
        const before = fingerprint()

        withPatchedInput(
            // A patch rewrites the JS wrapper AND the native sources while the
            // resolved version and the generated manifests stay identical.
            'patches/@zerodev__webauthn-key.patch',
            (content) => `${content}\n`,
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('moves when a dependency is added, whatever it is called', () => {
        const before = fingerprint()

        withPatchedInput(
            'package.json',
            // The name-heuristic gap: a native plugin called neither
            // capacitor/cordova nor a first-party scope, whose generated
            // manifests are also stale. Hashing the dependency NAME SET catches
            // it; hashing their versions too would refuse an OTA on every JS
            // bump, and a check that cries wolf gets switched off.
            (content) => content.replace('"dependencies": {', '"dependencies": {\n    "some-native-thing": "^1.0.0",'),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('refuses an unresolvable ref instead of hashing an empty tree', () => {
        const result = run(fixture.dir, '--ref', 'v99.99.99-does-not-exist')

        // Both git reads fail quietly for an unknown ref, which would produce a
        // well-formed fingerprint of nothing that differs from any real tree —
        // so a --diff against a missing tag would report "changed" and look
        // like the check had run.
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('does not resolve')
    })

    it('rejects --diff without a ref rather than comparing against nothing', () => {
        const result = run(fixture.dir, '--diff')

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('needs a git ref')
    })

    it('rejects --root without a directory', () => {
        const result = spawnSync(process.execPath, [SCRIPT_PATH, '--root'], { encoding: 'utf-8' })

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('needs a directory')
    })
})
