#!/usr/bin/env node

/**
 * Post-`cap sync ios` fixups that Capacitor's SPM generator can't do itself.
 *
 * SumSub: @sumsub/cordova-idensic-mobile-sdk-plugin declares its native
 * dependency `IdensicMobileSDK` only via a CocoaPods <podspec>. Capacitor's SPM
 * generator ignores that, so the generated Package.swift has no way to resolve
 * `#import <IdensicMobileSDK/IdensicMobileSDK.h>` and the archive fails with
 * "'IdensicMobileSDK/IdensicMobileSDK.h' file not found".
 *
 * `npx cap sync ios` regenerates the plugin's Package.swift and wipes its
 * Frameworks dir on every run, so this must run *after* each sync. The iOS
 * release workflow invokes it right after `cap sync`.
 *
 * Fix: vendor SumSub's xcframework as an SPM binaryTarget.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Must match the pin in the plugin's plugin.xml (<pod name="IdensicMobileSDK" spec="=X" />).
const SUMSUB_VERSION = '1.42.0'

const repoRoot = path.join(__dirname, '..')
const pluginPkg = '@sumsub/cordova-idensic-mobile-sdk-plugin'
const pluginDir = path.join(repoRoot, 'ios/capacitor-cordova-ios-plugins/sources/SumsubCordovaIdensicMobileSdkPlugin')
const frameworksDir = path.join(pluginDir, 'Frameworks')
const xcframework = path.join(frameworksDir, 'IdensicMobileSDK.xcframework')
const pkgSwiftPath = path.join(pluginDir, 'Package.swift')
const capAppPkgSwift = path.join(repoRoot, 'ios/App/CapApp-SPM/Package.swift')

const pluginInstalled = (() => {
    try {
        require.resolve(`${pluginPkg}/package.json`, { paths: [repoRoot] })
        return true
    } catch {
        return false
    }
})()

const capAppReferencesPlugin = (() => {
    try {
        return fs.readFileSync(capAppPkgSwift, 'utf8').includes('SumsubCordovaIdensicMobileSdkPlugin')
    } catch {
        return false
    }
})()

if (!fs.existsSync(pluginDir)) {
    // `cap sync ios` regenerates this dir from the installed Cordova plugin, but
    // when node_modules isn't fully materialized (a partial/interrupted pnpm
    // install) cap sync silently drops the plugin and STILL exits 0 — so the dir
    // is absent even though the committed CapApp-SPM/Package.swift hard-references
    // it, and the archive then dies a minute later with a cryptic SwiftPM
    // "folder doesn't exist" error. Skip only when the plugin is genuinely gone.
    if (!pluginInstalled && !capAppReferencesPlugin) {
        console.log(
            `[postsync] ${pluginPkg} not installed and not referenced by CapApp-SPM — plugin removed; nothing to vendor.`
        )
        process.exit(0)
    }
    console.error(
        `[postsync] ERROR: ${pluginDir} is missing after \`cap sync ios\`.\n` +
            `  It is generated from ${pluginPkg}, which ${pluginInstalled ? 'IS installed' : 'is NOT installed'} in node_modules.\n` +
            (pluginInstalled
                ? '  cap sync failed to detect it — usually a partial/interrupted `pnpm install` that left the package unresolved at sync time.\n'
                : '  The package is missing from node_modules — `pnpm install` did not materialize it.\n') +
            `  ios/App/CapApp-SPM/Package.swift ${capAppReferencesPlugin ? 'references' : 'does not reference'} this package, so the archive would fail with a cryptic SwiftPM error.\n` +
            '  Fix: re-run `pnpm install && npx cap sync ios && node scripts/native-ios-postsync.js`.'
    )
    process.exit(1)
}

// 1. Vendor the xcframework (download once; it survives within a single CI run).
if (!fs.existsSync(xcframework)) {
    fs.mkdirSync(frameworksDir, { recursive: true })
    const zipUrl = `https://raw.githubusercontent.com/SumSubstance/IdensicMobileSDK-iOS-Release/master/${SUMSUB_VERSION}/IdensicMobileSDK-${SUMSUB_VERSION}.zip`
    const zipPath = path.join(frameworksDir, 'IdensicMobileSDK.zip')
    console.log(`[postsync] downloading IdensicMobileSDK ${SUMSUB_VERSION}…`)
    execSync(`curl -fsSL -o "${zipPath}" "${zipUrl}"`, { stdio: 'inherit' })
    // Core subspec only needs IdensicMobileSDK.xcframework (top-level in the zip).
    execSync(`unzip -oq "${zipPath}" "IdensicMobileSDK.xcframework/*" -d "${frameworksDir}"`, {
        stdio: 'inherit',
    })
    fs.rmSync(zipPath, { force: true })
    if (!fs.existsSync(xcframework)) {
        console.error('[postsync] ERROR: IdensicMobileSDK.xcframework not found after extraction')
        process.exit(1)
    }
    console.log('[postsync] vendored IdensicMobileSDK.xcframework')
}

// 2. Patch the generated Package.swift to declare + depend on the binary target.
let pkg = fs.readFileSync(pkgSwiftPath, 'utf8')
if (pkg.includes('IdensicMobileSDK')) {
    console.log('[postsync] Package.swift already patched')
} else {
    const before = pkg

    // (a) declare the binary target at the top of the targets array
    pkg = pkg.replace(
        'targets: [\n',
        'targets: [\n' +
            '        .binaryTarget(\n' +
            '            name: "IdensicMobileSDK",\n' +
            '            path: "Frameworks/IdensicMobileSDK.xcframework"\n' +
            '        ),\n'
    )

    // (b) add it to the plugin target's dependencies
    pkg = pkg.replace(
        '.product(name: "Cordova", package: "capacitor-swift-pm")\n',
        '.product(name: "Cordova", package: "capacitor-swift-pm"),\n' + '                "IdensicMobileSDK"\n'
    )

    // (c) keep the framework dir out of the source-file glob.
    // SwiftPM enforces argument order: `exclude:` must precede `publicHeadersPath:`.
    pkg = pkg.replace(
        'path: ".",\n            publicHeadersPath: "."',
        'path: ".",\n            exclude: ["Frameworks"],\n            publicHeadersPath: "."'
    )

    if (pkg === before) {
        console.error('[postsync] ERROR: Package.swift did not match expected layout — patch anchors stale')
        process.exit(1)
    }
    fs.writeFileSync(pkgSwiftPath, pkg)
    console.log('[postsync] patched Package.swift with IdensicMobileSDK binary target')
}
