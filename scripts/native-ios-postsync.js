#!/usr/bin/env node

/**
 * Post-`cap sync ios` fixups that Capacitor's SPM generator can't do itself,
 * plus the MARKETING_VERSION sync (see step 0 below).
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
const { toMarketingVersion, stampMarketingVersion } = require('./marketing-version')

// Must match the pin in the plugin's plugin.xml (<pod name="IdensicMobileSDK" spec="=X" />).
const SUMSUB_VERSION = '1.42.0'

const repoRoot = path.join(__dirname, '..')
const pluginPkg = '@sumsub/cordova-idensic-mobile-sdk-plugin'
const pluginDir = path.join(repoRoot, 'ios/capacitor-cordova-ios-plugins/sources/SumsubCordovaIdensicMobileSdkPlugin')
const frameworksDir = path.join(pluginDir, 'Frameworks')
const xcframework = path.join(frameworksDir, 'IdensicMobileSDK.xcframework')
const pkgSwiftPath = path.join(pluginDir, 'Package.swift')
const capAppPkgSwift = path.join(repoRoot, 'ios/App/CapApp-SPM/Package.swift')
const pbxprojPath = path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj')

/*
 * 0. MARKETING_VERSION <- package.json.
 *
 * Deliberately ahead of every early exit below: the SumSub vendoring can
 * legitimately bail out when the plugin is uninstalled, and the version stamp
 * must not bail with it. Android has derived versionName from package.json
 * since native-release.sh; this is the iOS half, and it runs on every
 * `cap sync ios` — CI and local alike — so the project value can no longer
 * drift from the release it is shipping.
 */
;(function syncMarketingVersion() {
    const { version } = require(path.join(repoRoot, 'package.json'))
    const marketingVersion = toMarketingVersion(version)
    const before = fs.readFileSync(pbxprojPath, 'utf8')
    const after = stampMarketingVersion(before, marketingVersion)

    if (after === before) {
        console.log(`[postsync] MARKETING_VERSION already ${marketingVersion}`)
        return
    }
    fs.writeFileSync(pbxprojPath, after)
    console.log(`[postsync] MARKETING_VERSION -> ${marketingVersion} (from package.json)`)
})()

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

/*
 * 3. MeaWallet MPP SDK (Apple Pay push provisioning) — optional vendoring.
 *
 * The xcframework is proprietary, credential-gated (MeaWallet Nexus) and never
 * committed. When MEAWALLET_NEXUS_USER/PASSWORD are present (CI secret, or a
 * dev who fetched the 1Password credentials) it is downloaded and wired into
 * CapApp-SPM as a binaryTarget; without credentials this section is skipped
 * and PushProvisioningPlugin.swift compiles to its canImport-fenced stub, so
 * every build stays green.
 */
;(function vendorMeaWallet() {
    const MPP_VERSION = '2.0.0'
    const mppFrameworksDir = path.join(repoRoot, 'ios/App/CapApp-SPM/Frameworks')
    const mppXcframework = path.join(mppFrameworksDir, 'MeaPushProvisioning.xcframework')
    const capPkgPath = path.join(repoRoot, 'ios/App/CapApp-SPM/Package.swift')

    const user = process.env.MEAWALLET_NEXUS_USER
    const pass = process.env.MEAWALLET_NEXUS_PASSWORD

    if (!fs.existsSync(mppXcframework)) {
        if (!user || !pass) {
            console.log('[postsync] MeaWallet Nexus credentials not set — skipping MPP SDK (push provisioning stubbed)')
            return
        }
        fs.mkdirSync(mppFrameworksDir, { recursive: true })
        const zipUrl = `https://nexus.ext.meawallet.com/repository/mpp-ios-group/ios/mpp-prod/${MPP_VERSION}/mpp-prod-${MPP_VERSION}.zip`
        const zipPath = path.join(mppFrameworksDir, 'mpp.zip')
        console.log(`[postsync] downloading MeaPushProvisioning ${MPP_VERSION}…`)
        // Credentials via env in the curl config, never on the command line (ps-visible).
        execSync(`curl -fsSL --config - -o "${zipPath}" "${zipUrl}"`, {
            stdio: ['pipe', 'inherit', 'inherit'],
            input: `user = "${user}:${pass}"\n`,
        })
        execSync(`unzip -oq "${zipPath}" -d "${mppFrameworksDir}"`, { stdio: 'inherit' })
        fs.rmSync(zipPath, { force: true })
        if (!fs.existsSync(mppXcframework)) {
            // The zip may nest the framework one level down — find and move it.
            const found = execSync(
                `find "${mppFrameworksDir}" -maxdepth 3 -name MeaPushProvisioning.xcframework -type d | head -1`
            )
                .toString()
                .trim()
            if (!found) {
                console.error('[postsync] ERROR: MeaPushProvisioning.xcframework not found after extraction')
                process.exit(1)
            }
            fs.renameSync(found, mppXcframework)
        }
        console.log('[postsync] vendored MeaPushProvisioning.xcframework')
    }

    // Patch the generated CapApp-SPM Package.swift (cap sync rewrites it, so
    // this runs after every sync — same lifecycle as the SumSub patch above).
    let capPkg = fs.readFileSync(capPkgPath, 'utf8')
    if (capPkg.includes('MeaPushProvisioning')) {
        console.log('[postsync] CapApp-SPM Package.swift already patched for MPP')
        return
    }
    // Each anchor is validated on its own — a half-applied patch would leave
    // the binary target undeclared (or unused), and the Swift plugin would
    // silently compile its canImport stub instead of failing the build.
    const afterTarget = capPkg.replace(
        'targets: [\n',
        'targets: [\n' +
            '        .binaryTarget(\n' +
            '            name: "MeaPushProvisioning",\n' +
            '            path: "Frameworks/MeaPushProvisioning.xcframework"\n' +
            '        ),\n'
    )
    if (afterTarget === capPkg) {
        console.error('[postsync] ERROR: CapApp-SPM Package.swift `targets: [` anchor not found — MPP patch stale')
        process.exit(1)
    }
    capPkg = afterTarget.replace(
        '.product(name: "SumsubCordovaIdensicMobileSdkPlugin", package: "SumsubCordovaIdensicMobileSdkPlugin")\n',
        '.product(name: "SumsubCordovaIdensicMobileSdkPlugin", package: "SumsubCordovaIdensicMobileSdkPlugin"),\n' +
            '                "MeaPushProvisioning"\n'
    )
    if (capPkg === afterTarget) {
        console.error('[postsync] ERROR: CapApp-SPM Package.swift dependencies anchor not found — MPP patch stale')
        process.exit(1)
    }
    fs.writeFileSync(capPkgPath, capPkg)
    console.log('[postsync] patched CapApp-SPM Package.swift with MeaPushProvisioning binary target')
})()
