#!/usr/bin/env node

// A replacement build may reuse the current native version only when every
// native change since that version belongs to the platform being rebuilt.
// Shared changes (Capacitor config, cross-platform plugin versions, patches)
// are deliberately rejected: they may alter both shells, even when the
// immediate incident was observed on one platform. Platform runtime dependency
// inputs live below android/ or ios/ and therefore remain attributable.

const PLATFORM_PREFIXES = {
    android: 'android/',
    ios: 'ios/',
}

// A same-version replacement is delivered alongside older binaries with the
// same native versionName, so an OTA cannot distinguish the two populations.
// Only changes that repair binary packaging without creating a new JS/native
// contract are safe here. Broader Android changes need the coordinated native
// release, where both platforms and the OTA floor advance together.
const LEGACY_COMPATIBLE_INPUTS = {
    android: new Set(['android/app/proguard-rules.pro']),
    ios: new Set(),
}

function changesOutsidePlatform(changes, platform) {
    const prefix = PLATFORM_PREFIXES[platform]
    if (!prefix) throw new Error(`unknown platform "${platform}" — expected android or ios`)
    return changes.filter(({ path }) => !path.startsWith(prefix))
}

function changesUnsafeForSameVersion(changes, platform) {
    const allowed = LEGACY_COMPATIBLE_INPUTS[platform]
    if (!allowed) throw new Error(`unknown platform "${platform}" — expected android or ios`)
    return changes.filter(({ path }) => !allowed.has(path))
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}

async function main(argv) {
    const [baseRef, platform] = argv
    if (!baseRef || !platform) {
        throw new Error(
            'usage: check-native-change-scope.cjs <base-ref> <android|ios> [--ref <head-ref>] [--legacy-compatible]'
        )
    }

    const { diff } = await import('./native-fingerprint.mjs')
    const headRef = flag(argv, '--ref')
    if (argv.includes('--ref') && !headRef) throw new Error('--ref needs a git ref')
    const changes = diff(baseRef, headRef)
    const outside = changesOutsidePlatform(changes, platform)
    if (outside.length > 0) {
        const paths = outside.map(({ path }) => `  ${path}`).join('\n')
        throw new Error(
            `native changes since ${baseRef} are not ${platform}-only:\n${paths}\n` +
                'Run the coordinated App Release Android & iOS workflow so every affected platform advances together.'
        )
    }

    if (argv.includes('--legacy-compatible')) {
        const unsafe = changesUnsafeForSameVersion(changes, platform)
        if (unsafe.length > 0) {
            const paths = unsafe.map(({ path }) => `  ${path}`).join('\n')
            throw new Error(
                `native changes since ${baseRef} are not safe for older same-version ${platform} installs:\n${paths}\n` +
                    'A replacement versionName cannot gate these changes away from older binaries. Run the coordinated App Release Android & iOS workflow instead.'
            )
        }
    }

    const changed = changes.map(({ path }) => path)
    return changed.length === 0
        ? `no native changes since ${baseRef}; ${platform} replacement build is safe`
        : `${platform}-only native changes since ${baseRef}:\n${changed.map((path) => `  ${path}`).join('\n')}`
}

if (require.main === module) {
    main(process.argv.slice(2))
        .then((result) => process.stdout.write(`${result}\n`))
        .catch((err) => {
            console.error(`✗ native-change-scope: ${err.message}`)
            process.exit(1)
        })
}

module.exports = { changesOutsidePlatform, changesUnsafeForSameVersion, LEGACY_COMPATIBLE_INPUTS }
