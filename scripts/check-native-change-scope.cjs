#!/usr/bin/env node

// A replacement build may reuse the current native version only when every
// native change since that version belongs to the platform being rebuilt.
// Shared changes (Capacitor config, plugin versions, patches) are deliberately
// rejected: they may alter both shells, even when the immediate incident was
// observed on one platform.

const PLATFORM_PREFIXES = {
    android: 'android/',
    ios: 'ios/',
}

function changesOutsidePlatform(changes, platform) {
    const prefix = PLATFORM_PREFIXES[platform]
    if (!prefix) throw new Error(`unknown platform "${platform}" — expected android or ios`)
    return changes.filter(({ path }) => !path.startsWith(prefix))
}

async function main([baseRef, platform]) {
    if (!baseRef || !platform) {
        throw new Error('usage: check-native-change-scope.cjs <base-ref> <android|ios>')
    }

    const { diff } = await import('./native-fingerprint.mjs')
    const changes = diff(baseRef)
    const outside = changesOutsidePlatform(changes, platform)
    if (outside.length > 0) {
        const paths = outside.map(({ path }) => `  ${path}`).join('\n')
        throw new Error(
            `native changes since ${baseRef} are not ${platform}-only:\n${paths}\n` +
                'Run the coordinated Release Native workflow so every affected platform advances together.'
        )
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

module.exports = { changesOutsidePlatform }
