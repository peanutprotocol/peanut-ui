/**
 * Per-platform OTA floors. One release tag names two binaries and the field does
 * not keep them in step, so "which binaries may receive this bundle" is a
 * question about each platform's native surface, not about a version number.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '..', '..')
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'ota-platform-floor.mjs')

// Its own repo per case: the tag list and the native surface at each tag are the
// whole input, so asserting against this checkout would pin the suite to
// whatever release history happens to exist.
function makeRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-floor-'))
    for (const rel of ['scripts', 'android/app/src/main', 'ios/App/App.xcodeproj', 'patches']) {
        fs.mkdirSync(path.join(dir, rel), { recursive: true })
    }
    for (const name of ['ota-platform-floor.mjs', 'native-fingerprint.mjs', 'release-version.mjs']) {
        fs.copyFileSync(path.join(REPO_ROOT, 'scripts', name), path.join(dir, 'scripts', name))
    }
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    write(dir, 'capacitor.config.ts', 'shared v1\n')
    write(dir, 'android/app/src/main/AndroidManifest.xml', 'android v1\n')
    write(dir, 'ios/App/App.xcodeproj/project.pbxproj', 'ios v1\n')

    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
    git('init', '-q')
    // Hermetic against a developer's global signing config.
    git('config', 'commit.gpgsign', 'false')
    git('config', 'tag.gpgsign', 'false')
    git('config', 'user.email', 't@t.t')
    git('config', 'user.name', 't')
    return { dir, git }
}

function write(dir, rel, contents) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), contents)
}

function release({ dir, git }, tag) {
    git('add', '-A')
    git('commit', '-q', '-m', tag, '--allow-empty')
    git('tag', '-a', tag, '-m', `Native release ${tag.slice(1)}`)
}

function floors(dir, ref = 'HEAD') {
    const out = execFileSync('node', [SCRIPT, '--root', dir, '--ref', ref], { cwd: dir, encoding: 'utf8' })
    return Object.fromEntries(
        out
            .trim()
            .split('\n')
            .map((line) => line.split('='))
    )
}

function lowest(dir) {
    return execFileSync('node', [SCRIPT, '--root', dir, '--lowest'], { cwd: dir, encoding: 'utf8' }).trim()
}

function floorsFail(dir, platform) {
    const res = require('child_process').spawnSync('node', [SCRIPT, '--root', dir, '--platform', platform], {
        cwd: dir,
        encoding: 'utf8',
    })
    return { status: res.status, stderr: res.stderr }
}

it.each([
    ['@capacitor/android', '1.6.0', '1.5.0'],
    ['@capacitor/ios', '1.5.0', '1.6.0'],
    ['@capacitor/core', '1.6.0', '1.6.0'],
    ['@capacitor-community/example-plugin', '1.6.0', '1.6.0'],
])('a %s dependency bump raises only the affected native floors', (dependency, android, ios) => {
    const repo = makeRepo()
    const dependencies = {
        '@capacitor/android': '8.2.0',
        '@capacitor/ios': '8.2.0',
        '@capacitor/core': '8.2.0',
        '@capacitor-community/example-plugin': '8.2.0',
    }
    write(repo.dir, 'package.json', JSON.stringify({ version: '1.0.0', dependencies }))
    const lockfile = () =>
        'packages:\n' +
        Object.entries(dependencies)
            .map(([name, version]) => `  '${name}@${version}': {}`)
            .join('\n')
    write(repo.dir, 'pnpm-lock.yaml', lockfile())
    release(repo, 'v1.5.0')
    // The declared range and generated manifests can remain unchanged; the
    // resolved lockfile version is the contract the next build actually uses.
    dependencies[dependency] = '8.3.0'
    write(repo.dir, 'pnpm-lock.yaml', lockfile())
    release(repo, 'v1.6.0')

    expect(floors(repo.dir)).toEqual({
        NEXT_PUBLIC_OTA_FLOOR_ANDROID: android,
        NEXT_PUBLIC_OTA_FLOOR_IOS: ios,
    })
    // The complete surface must still detect every dependency bump. Only the
    // platform floor comparison narrows the dependency set.
    const complete = require('child_process').spawnSync(
        'node',
        [path.join(REPO_ROOT, 'scripts/native-fingerprint.mjs'), '--root', repo.dir, '--diff', 'v1.5.0'],
        { encoding: 'utf8' }
    )
    expect(complete.status).toBe(1)
    expect(complete.stdout).toContain('native-plugin-versions')
})

it('lets an untouched platform keep its older binaries', () => {
    const repo = makeRepo()
    release(repo, 'v1.4.0')
    release(repo, 'v1.5.0')
    // The v1.6.0 shape from the real incident: Android-only native change.
    write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'android v2\n')
    release(repo, 'v1.6.0')

    expect(floors(repo.dir)).toEqual({
        NEXT_PUBLIC_OTA_FLOOR_ANDROID: '1.6.0',
        NEXT_PUBLIC_OTA_FLOOR_IOS: '1.4.0',
    })
})

it('raises both floors for a shared input, which describes both binaries', () => {
    const repo = makeRepo()
    release(repo, 'v1.4.0')
    write(repo.dir, 'capacitor.config.ts', 'shared v2\n')
    release(repo, 'v1.5.0')

    expect(floors(repo.dir)).toEqual({
        NEXT_PUBLIC_OTA_FLOOR_ANDROID: '1.5.0',
        NEXT_PUBLIC_OTA_FLOOR_IOS: '1.5.0',
    })
})

it('raises only the iOS floor for an iOS-only change', () => {
    const repo = makeRepo()
    release(repo, 'v1.4.0')
    write(repo.dir, 'ios/App/App.xcodeproj/project.pbxproj', 'ios v2\n')
    release(repo, 'v1.5.0')

    expect(floors(repo.dir)).toEqual({
        NEXT_PUBLIC_OTA_FLOOR_ANDROID: '1.4.0',
        NEXT_PUBLIC_OTA_FLOOR_IOS: '1.5.0',
    })
})

// A native change made and then reverted does not make the binaries in between
// able to run this JS — they are exactly the binaries the change was made for.
it('stops at the first mismatch instead of reaching past it', () => {
    const repo = makeRepo()
    release(repo, 'v1.3.0')
    write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'android interim\n')
    release(repo, 'v1.4.0')
    write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'android v1\n')
    release(repo, 'v1.5.0')

    expect(floors(repo.dir).NEXT_PUBLIC_OTA_FLOOR_ANDROID).toBe('1.5.0')
})

it('refuses when no shipped binary of that platform carries this surface', () => {
    const repo = makeRepo()
    release(repo, 'v1.5.0')
    write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'unreleased\n')
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', 'drift')

    const { status, stderr } = floorsFail(repo.dir, 'android')
    expect(status).toBe(1)
    expect(stderr).toContain("no shipped android binary carries this tree's native contract")
    // iOS is untouched, so it still resolves — the platforms are independent.
    expect(
        execFileSync('node', [SCRIPT, '--root', repo.dir, '--platform', 'ios'], {
            cwd: repo.dir,
            encoding: 'utf8',
        }).trim()
    ).toBe('1.5.0')
})

it('refuses a repository with no native release at all', () => {
    const repo = makeRepo()
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', 'no releases')

    const { status, stderr } = floorsFail(repo.dir, 'android')
    expect(status).toBe(1)
    expect(stderr).toMatch(/no v\*? ?tags?|no v<major>/)
})

it('rejects an unknown platform', () => {
    const repo = makeRepo()
    release(repo, 'v1.5.0')
    const { status, stderr } = floorsFail(repo.dir, 'windows')
    expect(status).toBe(1)
    expect(stderr).toContain('platform must be android or ios')
})

/*
 * --lowest is the single number Capgo gets, because one bundle serves both
 * platforms and a channel carries one min_update_version. Every install's
 * eligibility goes through it, and the per-platform cases above would stay green
 * if it picked the wrong side.
 */
describe('--lowest, the shared server floor', () => {
    it('takes the iOS side when iOS is lower', () => {
        const repo = makeRepo()
        release(repo, 'v1.4.0')
        release(repo, 'v1.5.0')
        write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'android v2\n')
        release(repo, 'v1.6.0')

        expect(floors(repo.dir)).toEqual({
            NEXT_PUBLIC_OTA_FLOOR_ANDROID: '1.6.0',
            NEXT_PUBLIC_OTA_FLOOR_IOS: '1.4.0',
        })
        expect(lowest(repo.dir)).toBe('1.4.0')
    })

    it('takes the Android side when Android is lower', () => {
        const repo = makeRepo()
        release(repo, 'v1.4.0')
        release(repo, 'v1.5.0')
        write(repo.dir, 'ios/App/App.xcodeproj/project.pbxproj', 'ios v2\n')
        release(repo, 'v1.6.0')

        expect(floors(repo.dir)).toEqual({
            NEXT_PUBLIC_OTA_FLOOR_ANDROID: '1.4.0',
            NEXT_PUBLIC_OTA_FLOOR_IOS: '1.6.0',
        })
        expect(lowest(repo.dir)).toBe('1.4.0')
    })

    it('compares builds numerically, not lexically', () => {
        const repo = makeRepo()
        release(repo, 'v1.9.0')
        write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'android v2\n')
        release(repo, 'v1.10.0')

        expect(floors(repo.dir)).toEqual({
            NEXT_PUBLIC_OTA_FLOOR_ANDROID: '1.10.0',
            NEXT_PUBLIC_OTA_FLOOR_IOS: '1.9.0',
        })
        expect(lowest(repo.dir)).toBe('1.9.0')
    })
})

/*
 * A major is a deliberate app-generation break. release-version.mjs keeps a
 * bundle's floor inside one major band, and the on-device comparison checks
 * majors before builds — so a floor reaching back across the boundary would have
 * every 1.x binary accept a 2.x bundle.
 */
describe('major boundary', () => {
    const acrossMajors = () => {
        const repo = makeRepo()
        release(repo, 'v1.5.0')
        release(repo, 'v1.6.0')
        // A new generation whose iOS surface is untouched all the way back.
        write(repo.dir, 'android/app/src/main/AndroidManifest.xml', 'android v2\n')
        release(repo, 'v2.1.0')
        return repo
    }

    it('does not reach past the newest major, even when the surface matches', () => {
        const repo = acrossMajors()
        expect(floors(repo.dir)).toEqual({
            NEXT_PUBLIC_OTA_FLOOR_ANDROID: '2.1.0',
            NEXT_PUBLIC_OTA_FLOOR_IOS: '2.1.0',
        })
    })

    it('keeps the shared server floor inside the same band', () => {
        expect(lowest(acrossMajors().dir)).toBe('2.1.0')
    })
})
