/**
 * Derives the iOS MARKETING_VERSION from package.json, the same way
 * native-release.sh derives Android's versionName.
 *
 * The Xcode project shipped a hand-maintained `MARKETING_VERSION = 1.0`, so
 * every iOS release had to pass an explicit versionName or TestFlight received a
 * build labelled 1.0. That override was load-bearing and silently wrong whenever
 * anyone forgot it — 1.0.47 was the last release where the project value and the
 * real version had nothing to do with each other.
 */

/**
 * Normalizes a package.json version to the three-component form Apple wants,
 * so the patch component is the one that moves each release.
 *
 * Apple accepts one to three dot-separated non-negative integers and nothing
 * else, so a prerelease suffix (`1.0.48-rc.1`) has to be dropped rather than
 * passed through — App Store Connect rejects the upload otherwise.
 */
function toMarketingVersion(rawVersion) {
    const parts = String(rawVersion ?? '')
        .split('-')[0]
        .split('.')
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isInteger(part) && part >= 0)

    if (parts.length === 0) throw new Error(`Cannot derive a MARKETING_VERSION from "${rawVersion}"`)

    while (parts.length < 3) parts.push(0)
    return parts.slice(0, 3).join('.')
}

/**
 * Rewrites every MARKETING_VERSION in a project.pbxproj — there is one per build
 * configuration (Debug and Release), and they must not drift apart.
 */
function stampMarketingVersion(pbxproj, marketingVersion) {
    if (!/MARKETING_VERSION = [^;]*;/.test(pbxproj)) {
        throw new Error('No MARKETING_VERSION found in project.pbxproj — the patch anchor is stale')
    }
    return pbxproj.replace(/MARKETING_VERSION = [^;]*;/g, `MARKETING_VERSION = ${marketingVersion};`)
}

module.exports = { toMarketingVersion, stampMarketingVersion }
